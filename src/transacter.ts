//import TrezorConnect from '@trezor/connect';
//import TrezorConnect from '@trezor/connect-web';
//const TrezorConnect = require('trezor-connect')
declare let TrezorConnect: any;
let everyUTXO = [];
let Coin = "Bitcoin";

const fromAddressInput = <HTMLInputElement>(
  document.getElementById("from-address")
);
const fromAddressPathInput = <HTMLInputElement>(
  document.getElementById("from-address-path")
);
const utxoCountInput = <HTMLInputElement>document.getElementById("utxo-count");
const toAddressInput = <HTMLInputElement>document.getElementById("to-address");
const pushTxInput = <HTMLInputElement>document.getElementById("push-tx");
const txFeeInput = <HTMLInputElement>document.getElementById("tx-fee");

function tx_detail(tx, idx) {
  //let headers = {'User-Agent': 'trezorlib'}
  //let webserver = (idx % 5) + 1
  //let url = "https://btc"+webserver+".trezor.io/api/tx-specific/"+tx.tx_hash
  let headers = {};
  let url = "https://www.bitgo.com/api/v1/tx/" + tx.tx_hash;
  return fetch(url, headers).then((result) => {
    return result.json().then((json) => {
      let msg =
        "utxo detail #" + (idx + 1) + "/" + everyUTXO.length + " loaded";
      document.getElementById("utxo-count-detail").textContent = msg;
      return { meta: tx, tx: json };
    });
  });
}

function pick_trezor_account() {
  document.getElementById("trezor-lookup-detail").textContent = "";
  let acctInfoParams = {
    path: fromAddressPathInput.value.trim(),
    coin: Coin,
    details: "txs",
    tokens: "derived",
    defaultAccountType: "legacy",
  };
  console.log("acctInfoParams", acctInfoParams);
  return TrezorConnect.getAccountInfo(acctInfoParams).then((out) => {
    if (out.success) {
      console.log("getAccountInfo", out);
      document.getElementById("trezor-lookup-detail-address").textContent =
        out.payload.address;
      document.getElementById("trezor-lookup-detail-path").textContent =
        "m/" + out.payload.addressSerializedPath;
    } else {
      document.getElementById("trezor-lookup-detail").textContent =
        out.payload.error;
    }
  });
}

function isTestnet(address) {
  return false;
}

function load_utxos() {
  // clear out the old data
  everyUTXO = [];
  let count = utxoCountInput.value.trim();
  let fromAddress = fromAddressInput.value.trim();
  let bitgoHost = "bitgo.com";
  if (isTestnet(fromAddress)) {
    bitgoHost = "bitgo-test.com";
  }
  let msg = "Loading " + count + " UTXOs...";
  document.getElementById("from-address-detail").textContent = msg;
  let url =
    "https://www." +
    bitgoHost +
    "/api/v1/address/" +
    fromAddress +
    "/unspents?limit=" +
    count +
    "&skip=0";
  console.log(url);
  return fetch(url)
    .then((result) => result.json())
    .then((response) => {
      if (response.error) {
        document.getElementById("utxo-count-detail").textContent =
          response.error;
      } else {
        everyUTXO = response.unspents.slice(0, count);
        let value = everyUTXO.reduce((memo, tx) => memo + tx.value, 0);
        let msg =
          everyUTXO.length + " UTXOs loaded . total BTC: " + value / 10 ** 8;
        document.getElementById("from-address-detail").textContent = msg;

        // load individual UTXOs
        return Promise.all(
          everyUTXO.map((tx, idx) => {
            return {
              meta: tx,
            };
          })
        );
      }
    })
    .then((all) => (everyUTXO = all));
}

function bip44_to_int(path) {
  // "m/44'/0'/0'/0/0"
  return path
    .substring(2)
    .split("/")
    .map((part) => {
      let int_val = parseInt(part);
      if (part.endsWith("'")) {
        int_val = int_val | (1 << 31);
      }
      return int_val;
    });
}

function generate_transfer_uxto() {
  let inputs = everyUTXO.map((tx) => {
    return {
      prev_hash: tx.meta.tx_hash,
      prev_index: tx.meta.tx_output_n,
      amount: "" + tx.meta.value,
      address_n: bip44_to_int(fromAddressPathInput.value.trim()),
      //script_type: "SPENDADDRESS", //script_type,
    };
  });

  let tx_size = 1; // TODO
  let fee_value = parseInt(txFeeInput.value);
  if (pushTxInput.checked && !fee_value) {
    document.getElementById("post-tx-detail").textContent =
      "Please set the fee value";
    return;
  }
  let value = everyUTXO.reduce((memo, tx) => memo + tx.meta.value, 0);
  let total = value - fee_value;
  console.log("total", total, "value", value, "fee_value", fee_value);
  if (!(total > 0)) {
    document.getElementById("post-tx-detail").textContent =
      "Output value / fee value is in error: " + total;
    return;
  }
  if (fee_value / total > 0.01) {
    document.getElementById("post-tx-detail").textContent =
      "total fee " +
      fee_value +
      "(sats) is more than 1% of total " +
      total +
      "(sats). stopping";
    return;
  }
  let outputs = [
    {
      address: toAddressInput.value.trim(),
      script_type: "PAYTOADDRESS",
      amount: "" + total,
    },
  ];
  let version = 2;
  let lock_time = 0;
  let txdata = [];

  // txB.addInput(utxo.tx_hash, utxo.tx_output_n)
  // txB.addOutput(toAddress, value)

  // https://github.com/trezor/connect/blob/develop/docs/methods/signTransaction.md
  let params = {
    coin: Coin,
    inputs: inputs,
    outputs: outputs,
    details: {
      version: version,
      lock_time: lock_time,
    },
    prev_txes: {
      txhash: txdata,
    },
    push: pushTxInput.checked,
  };

  console.log("signTransaction inputs", params);
  TrezorConnect.signTransaction(params).then(function (result) {
    console.log("signTransaction output", result);
    if (result.success) {
      document.getElementById("post-tx-detail").textContent = "Success";
    } else {
      document.getElementById("post-tx-detail").textContent =
        result.payload.error;
    }
  });
}
