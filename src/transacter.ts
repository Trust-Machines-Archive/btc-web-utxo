let everyUTXO;

const fromAddr = <HTMLInputElement>document.getElementById("from-address");
const utxoCount = <HTMLInputElement>document.getElementById("utxo-count");
const toAddress = <HTMLInputElement>document.getElementById("to-address");

async function load_utxos() {
  let url =
    "https://www.bitgo.com/api/v1/address/" +
    fromAddr.value.trim() +
    "/unspents?limit=50&skip=0";
  let utxos = fetch(url).then((result) => result.json());
  return utxos.then((response) => {
    everyUTXO = response.unspents.slice(0, utxoCount.value.trim());
    let value = everyUTXO.reduce((memo, tx) => memo + tx.value, 0);
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
          msg =
            "utxo detail #" + (idx + 1) + "/" + everyUTXO.length + " loaded";
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
