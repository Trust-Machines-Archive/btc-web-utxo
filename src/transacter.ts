//import TrezorConnect from '@trezor/connect';
//import TrezorConnect from '@trezor/connect-web';
//const TrezorConnect = require('trezor-connect')
declare let TrezorConnect: any;
let everyUTXO;

const fromAddr = <HTMLInputElement>document.getElementById("from-address");
const utxoCount = <HTMLInputElement>document.getElementById("utxo-count");
const toAddress = <HTMLInputElement>document.getElementById("to-address");

function tx_detail(tx, idx) {
  //let headers = {'User-Agent': 'trezorlib'}
  //let webserver = (idx % 5) + 1
  //let url = "https://btc"+webserver+".trezor.io/api/tx-specific/"+tx.tx_hash
  let headers = {};
  let url = "https://www.bitgo.com/api/v1/tx/" + tx.tx_hash;
  return fetch(url, headers).then((result) => {
    result.json().then((json) => {
      console.log(json);
      let msg = "utxo detail #" + (idx + 1) + "/" + everyUTXO.length + " loaded";
      document.getElementById("utxo-count-detail").textContent = msg;
    });
  });
}

async function load_utxos() {
  // clear out the old data
  everyUTXO = []
  let count =  utxoCount.value.trim()
  let msg = "Loading "+count+" UTXOs"
  document.getElementById("from-address-detail").textContent = msg;
  let url =
    "https://www.bitgo.com/api/v1/address/" +
    fromAddr.value.trim() +
    "/unspents?limit="+count+"&skip=0";
  let utxos = fetch(url).then((result) => result.json());
  return utxos.then((response) => {
    everyUTXO = response.unspents.slice(0, count);
    let value = everyUTXO.reduce((memo, tx) => memo + tx.value, 0);
    let msg =
      everyUTXO.length +
      " UTXOs loaded (from " +
      everyUTXO.length +
      "). total BTC: " +
      value / 10 ** 8;
    document.getElementById("from-address-detail").textContent = msg;

    // load individual UTXOs
    return everyUTXO.map((tx, idx) => tx_detail(tx, idx));
  });
}

function generate_transfer_uxto() {
  let coin = "Bitcoin";
  let inputs = [];
  let outputs = [];
  let version = 2;
  let lock_time = 0;
  let txdata = [];
  //  txB.addInput(utxo.tx_hash, utxo.tx_output_n)
  // send to toAddress
  //txB.addOutput(toAddress, value)
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
  // https://github.com/trezor/connect/blob/develop/docs/methods/signTransaction.md
  TrezorConnect.signTransaction(params).then(function (result) {
    console.log(result);
  });
}
