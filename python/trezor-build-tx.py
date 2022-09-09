'''
brew install libusb gmp
CFLAGS=-I/opt/homebrew/opt/gmp/include LDFLAGS=-L/opt/homebrew/opt/gmp/lib poetry add bitcoinlib
poetry add trezor

python3 main.py > tx.json
trezorctl btc sign-tx tx.json

# https://github.com/trezor/trezor-firmware/blob/master/python/tools/build_tx.py
# https://github.com/trezor/trezor-firmware/tree/master/python/tools
# https://github.com/LedgerHQ/ledgerctl
'''

import decimal
import json
from typing import Any, Dict, List, Optional, Tuple
import multiprocessing

import requests
import click
import bitcoinlib
import trezorlib
import time

import logging

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

from trezorlib import btc, messages, tools
from trezorlib.cli import ChoiceType
from trezorlib.cli.btc import INPUT_SCRIPTS, OUTPUT_SCRIPTS
from trezorlib.protobuf import to_dict

# the following script type mapping is only valid for single-sig Trezor-generated utxos
BITCOIN_CORE_INPUT_TYPES = {
    "pubkeyhash": messages.InputScriptType.SPENDADDRESS,
    "scripthash": messages.InputScriptType.SPENDP2SHWITNESS,
    "witness_v0_keyhash": messages.InputScriptType.SPENDWITNESS,
    "witness_v1_taproot": messages.InputScriptType.SPENDTAPROOT,
}


def get_session():
    session = requests.Session()
    session.headers.update({"User-Agent": "trezorlib"})
    return session


def echo(*args: Any, **kwargs: Any):
    return click.echo(*args, err=True, **kwargs)


def prompt(*args: Any, **kwargs: Any):
    return click.prompt(*args, err=True, **kwargs)


def get_default_script_type(address_n: Optional[List[int]], script_types: Any) -> str:
    script_type = "address"

    if address_n is None:
        pass
    elif address_n[0] == tools.H_(49):
        script_type = "p2shsegwit"
    elif address_n[0] == tools.H_(84):
        script_type = "segwit"

    return script_type
    # return script_types[script_type]


def parse_vin(s: str) -> Tuple[bytes, int]:
    txid, vout = s.split(":")
    return bytes.fromhex(txid), int(vout)


def get_input(
        utxo,
        blockbook_url: str,
):
    prev = bytes.fromhex(utxo['txid']), int(utxo['output_n'])
    prev_hash, prev_index = prev

    txhash = prev_hash.hex()
    tx_url = blockbook_url + txhash

    r = get_session().get(tx_url)
    if not r.ok:
        raise click.ClickException(f"Failed to fetch URL: {tx_url}")

    tx_json = r.json(parse_float=decimal.Decimal)
    # print(tx_json)
    # if "error" in tx_json:
    #     raise click.ClickException(f"Transaction not found: {txhash}")

    tx = btc.from_json(tx_json)
    from_address = tx_json["vout"][prev_index]["scriptPubKey"]["address"]
    amount = tx.bin_outputs[prev_index].amount
    # echo(f"From address: {from_address} txid:{tx_json['txid']} amount:{amount}")

    address_n = tools.parse_path("m/44'/0'/0'/0/0")

    reported_type = tx_json["vout"][prev_index]["scriptPubKey"].get("type")
    if reported_type in BITCOIN_CORE_INPUT_TYPES:
        script_type = BITCOIN_CORE_INPUT_TYPES[reported_type]
        # click.echo(f"Script type: {script_type.name}") # SPENDADDRESS
    else:
        script_type = prompt(
            "Input type",
            type=ChoiceType(INPUT_SCRIPTS),
            default=get_default_script_type(address_n, INPUT_SCRIPTS),
        )
    if isinstance(script_type, str):
        script_type = INPUT_SCRIPTS[script_type]

    sequence = 0xFFFFFFFD

    new_input = messages.TxInputType(
        address_n=address_n,
        prev_hash=prev_hash,
        prev_index=prev_index,
        amount=amount,
        script_type=script_type,
        sequence=sequence,
    )

    return {'input': new_input, 'tx': tx, 'txhash': txhash}


def get_input_worker(queue, inputs, txes, blockbook_url):
    while True:
        try:
            utxo = queue.get()
        except KeyboardInterrupt:
            break
        try:
            result = get_input(utxo, blockbook_url)
            inputs.append(result['input'])
            txes[result['txhash']] = result['tx']
        except click.ClickException:
            queue.put(utxo)
            time.sleep(0.3)
        except Exception as e:
            echo(e)
            raise e
        finally:
            queue.task_done()


def counter_worker(queue):
    while True:
        qsize = queue.qsize()
        echo(f"queue: {qsize:_}")
        time.sleep(5)


def get_inputs_multithreaded(utxos):
    manager = multiprocessing.Manager()
    queue = manager.Queue()
    inputs = manager.list()
    txes = manager.dict()

    for utxo in utxos:
        queue.put(utxo)

    procs = []
    for i in range(5):
        blockbook_url = f'https://btc{i + 1}.trezor.io/api/tx-specific/'
        proc = multiprocessing.Process(target=get_input_worker, args=[queue, inputs, txes, blockbook_url])
        procs.append(proc)

    counter = multiprocessing.Process(target=counter_worker, args=[queue])

    for proc in procs:
        proc.start()
    counter.start()

    queue.join()
    counter.terminate()
    for proc in procs:
        proc.terminate()

    return list(inputs), dict(txes)


def get_outputs(address, amount) -> List[messages.TxOutputType]:
    outputs: List[messages.TxOutputType] = []
    address_n = None
    script_type = messages.OutputScriptType.PAYTOADDRESS

    outputs.append(
        messages.TxOutputType(
            address_n=address_n,
            address=address,
            amount=amount,
            script_type=script_type,
        )
    )

    return outputs


@click.command()
@click.option("--from-address", help="bitcoin address to send from")
@click.option("--utxo-count", help="number of UTXOs to load")
def sign(from_address, utxo_count) -> None:
    coin = 'Bitcoin'
    providers = ['blockchaininfo']  # max: 1000
    srv = bitcoinlib.services.services.Service(providers=providers)
    print(f"{providers[0]} {from_address} {utxo_count}")
    utxos = srv.getutxos(from_address, limit=int(utxo_count))
    amount = sum(utxo['value'] for utxo in utxos)
    echo(f'found utxos: {len(utxos):_} amount: {amount:_}')

    inputs, txes = get_inputs_multithreaded(utxos)
    echo(f'inputs={len(inputs)} txes={len(txes)}')
    outputs = get_outputs(from_address, amount)

    version = 2
    lock_time = 0

    result = {
        "coin_name": coin,
        "inputs": [to_dict(i, hexlify_bytes=True) for i in inputs],
        "outputs": [to_dict(o, hexlify_bytes=True) for o in outputs],
        "details": {
            "version": version,
            "lock_time": lock_time,
        },
        "prev_txes": {
            txhash: to_dict(txdata, hexlify_bytes=True)
            for txhash, txdata in txes.items()
        },
    }

    print(json.dumps(result, sort_keys=True, indent=2))


if __name__ == "__main__":
    sign()
