let everyUTXO;

const fromAddr = (<HTMLInputElement>(
  document.getElementById("from-address")
)).value.trim();
const utxoCount = (<HTMLInputElement>(
  document.getElementById("utxo-count")
)).value.trim();
const toAddress = (<HTMLInputElement>(
  document.getElementById("to-address")
)).value.trim();

async function load_utxos() {
  let url =
    "https://www.bitgo.com/api/v1/address/14CEjTd5ci3228J45GdnGeUKLSSeCWUQxK/unspents?limit=50&skip=0";
  let utxos = fetch(fromAddr).then((result) => result.json());
  return utxos.then((all) => {
    everyUTXO = all.slice(0, utxoCount);
    let value = everyUTXO.reduce((memo, tx) => {
      return memo + tx.value;
    }, 0);
    let msg =
      everyUTXO.length +
      " UTXOs loaded (from " +
      everyUTXO.length +
      "). total BTC: " +
      value / 10 ** 8;
    document.getElementById("from-address-detail").textContent = msg;

    // load individual UTXOs
    return everyUTXO.map((tx, idx) => {
      console.log("mapwtf", tx);
      //let headers = {'User-Agent': 'trezorlib'}
      //let webserver = (idx % 5) + 1
      //let url = "https://btc"+webserver+".trezor.io/api/tx-specific/"+tx.tx_hash
      let headers = {};
      let url = "https://www.bitgo.com/api/v1/tx/" + tx.tx_hash;
      return fetch(url, headers).then((result) => {
        result.json().then((json) => {
          console.log(json);
          msg = "utxo detail #" + idx + "/" + everyUTXO.length + " loaded";
          document.getElementById("utxo-count-detail").textContent = msg;
        });
      });
    });
  });
}

function generate_transfer_uxto() {
  //  txB.addInput(utxo.tx_hash, utxo.tx_output_n)
  // send to toAddress
  //txB.addOutput(toAddress, value)
}