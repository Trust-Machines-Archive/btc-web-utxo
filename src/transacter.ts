//import TrezorConnect from '@trezor/connect';
//import TrezorConnect from '@trezor/connect-web';
//const TrezorConnect = require('trezor-connect')
declare let TrezorConnect: any;
let everyUTXO;

const fromAddress = <HTMLInputElement>document.getElementById("from-address");
const utxoCount = <HTMLInputElement>document.getElementById("utxo-count");
const toAddress = <HTMLInputElement>document.getElementById("to-address");

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

function load_utxos() {
  // clear out the old data
  everyUTXO = [];
  let count = utxoCount.value.trim();
  let msg = "Loading " + count + " UTXOs";
  document.getElementById("from-address-detail").textContent = msg;
  let url =
    "https://www.bitgo.com/api/v1/address/" +
    fromAddress.value.trim() +
    "/unspents?limit=" +
    count +
    "&skip=0";
  return fetch(url)
    .then((result) => result.json())
    .then((response) => {
      everyUTXO = response.unspents.slice(0, count);
      let value = everyUTXO.reduce((memo, tx) => memo + tx.value, 0);
      let msg =
        everyUTXO.length + " UTXOs loaded . total BTC: " + value / 10 ** 8;
      document.getElementById("from-address-detail").textContent = msg;

      // load individual UTXOs
      return Promise.all(everyUTXO.map((tx, idx) => tx_detail(tx, idx)))
    })
    .then((all) => everyUTXO = all)
}

function generate_transfer_uxto() {
  let coin = "Bitcoin";
  let inputs = everyUTXO.map((tx) => {
    return {
      prev_hash: tx.meta.tx_hash,
      prev_index: tx.meta.tx_output_n,
      amount: tx.meta.value,
      address_n: "m/44'/0'/0'/0/0",
      script_type: "todo", //script_type,
    };
  });

  let value = everyUTXO.reduce((memo, tx) => memo + tx.meta.value, 0);
  let outputs = [{
    address: toAddress.value.trim(),
    script_type: 'PAYTOADDRESS',
    amount: value
  }];
  let version = 2;
  let lock_time = 0;
  let txdata = [];

  //  txB.addInput(utxo.tx_hash, utxo.tx_output_n)
  // send to toAddress
  //txB.addOutput(toAddress, value)

  // https://github.com/trezor/connect/blob/develop/docs/methods/signTransaction.md
  let params = {
    coin: coin,
    inputs: inputs,
    outputs: outputs,
    details: {
      version: version,
      lock_time: lock_time,
    },
    prev_txes: {
      txhash: txdata,
    },
  };

  console.log("signTransaction", params);
  TrezorConnect.signTransaction(params).then(function (result) {
    console.log(result);
  });
}
