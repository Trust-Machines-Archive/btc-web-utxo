let everyUTXO

async function load_utxos() {
  const fromAddr = document.getElementById('from-address').value.trim()
  const utxoCount= document.getElementById('utxo-count').value.trim()

  // let url = "https://www.bitgo.com/api/v1/address/14CEjTd5ci3228J45GdnGeUKLSSeCWUQxK/unspents?limit=50&skip=0"
  let utxos = bsk.config.network.getNetworkedUTXOs(fromAddr)
  return utxos.then((all) => {
    everyUTXO = all.slice(0, utxoCount)
    let value = everyUTXO.reduce((memo, tx) => { return memo + tx.value }, 0)
    let msg = everyUTXO.length + " UTXOs loaded (from "+everyUTXO.length+"). total BTC: " + value/10**8
    document.getElementById('from-address-detail').textContent = msg
    
    // load individual UTXOs
    return everyUTXO.map((tx, idx) => {
      console.log('mapwtf', tx)
      //let headers = {'User-Agent': 'trezorlib'}
      //let webserver = (idx % 5) + 1
      //let url = "https://btc"+webserver+".trezor.io/api/tx-specific/"+tx.tx_hash
      let headers = {}
      let url = "https://www.bitgo.com/api/v1/tx/"+tx.tx_hash
      return fetch(url, headers).then((result) => {
        result.json().then((json) => {
          console.log(json)
          msg = "utxo detail #"+idx+"/"+everyUTXO.length+" loaded"
          document.getElementById('utxo-count-detail').textContent = msg
        })
      })
    })
  })
}

function generate_transfer_uxto() {
  const fromAddr = document.getElementById('from-address').value.trim()
  const toAddress = document.getElementById('to-address').value.trim()

  //  txB.addInput(utxo.tx_hash, utxo.tx_output_n)
  
  // send to toAddress
  txB.addOutput(toAddress, value)


}

async function hardware_sign() {
  const tx_hex = document.getElementById('sign-input').value.trim()
  const txB = btc.TransactionBuilder.fromTransaction(btc.Transaction.fromHex(tx_hex))

  const device =  document.getElementById('transact-device').value.trim()
  if (device == "ledger") {
  } else if (device == "trezor") {
    trezorSign(getPath(), txB)
  }
}

let specificUTXO;
bsk.config.network.getUTXOs = (address) => {
  return bsk.config.network.getNetworkedUTXOs(address)
    .then(
    (allUTXOs) => {
      if (specificUTXO) {
        let returnSet = allUTXOs.filter(
          (utxo) => {
            console.log(`Checking for inclusion: ${utxo}`);
            return utxo.tx_hash === specificUTXO
          }
        );
        return returnSet
      } else {
        return allUTXOs
      }
    }
  )
}

bsk.config.network.getFeeRate = function() {
  return fetch('https://bitcoinfees.earn.com/api/v1/fees/recommended')
      .then(resp => resp.json())
      .then(rates => Math.floor(2.3 * (rates.fastestFee / 5)))
}

bsk.config.network.getConsensusHash = function() {
  return Promise.resolve("00000000000000000000000000000000")
}

function getPath() {
  return document.getElementById('transact-path').value.trim()
}

function getXPUB() {
  const path = getPath()
  return TrezorConnect.getPublicKey({ path })
    .then((result) => {
      console.log(JSON.stringify(result, undefined, 2))
      return result.payload.xpub
    })
    .then((xpub) => {
      displayMessage('xpub', xpub)
    })
}


function trezorSign(path, message) {
  return TrezorConnect.signMessage({ path, message, coin: 'BTC' })
    .then(result => {
      if (!result.success) {
        throw new Error('Trezor refused to sign!')
      } else {
        return { signature: result.payload.signature,
                 address: result.payload.address }
      }
    })
    .then(({signature, address}) => {
      const data = { signature,
                     message,
                     address }
      displayMessage('sign', JSON.stringify(data, undefined, 2))
    })
}

function generate() {
  const fromAddr = document.getElementById('from-address').value.trim()
  const fromPKsHex = document.getElementById('from-pubkeys').value.trim().split(',').map(x => x.trim())
  const requiredSigners = parseInt(document.getElementById('from-n').value.trim())

  if (isNaN(requiredSigners) || requiredSigners <= 0) {
    displayMessage('tx', 'Invalid input in amount to send -- must be a positive integer.', 'ERROR')
    return
  }

  return Promise.resolve().then(() => {
    let authorizedPKs = fromPKsHex.slice().sort().map((k) => Buff.from(k, 'hex'))
    let redeem = btc.payments.p2ms({ m: requiredSigners, pubkeys: authorizedPKs })
    let redeemScript = redeem.output.toString('hex')

    let btcFromAddr = btc.payments.p2sh({ redeem }).address
    let c32FromAddr = c32.b58ToC32(btcFromAddr)
    if (c32FromAddr !== fromAddr) {
      console.log('Failed to compute correct address from PKs, trying alternate combination');
      authorizedPKs_unsorted = fromPKsHex.map((k) => Buff.from(k, 'hex'))
      redeem = btc.payments.p2ms({ m: requiredSigners, pubkeys: authorizedPKs_unsorted })
      redeemScript = redeem.output.toString('hex')

      btcFromAddr = btc.payments.p2sh({ redeem }).address
      c32FromAddr = c32.b58ToC32(btcFromAddr)

      if (c32FromAddr !== fromAddr) {
        throw new Error('Computed address (from PKs and required signer) does not match inputted address')
      }
    }

    const dummySigner = new bskTrezor.NullSigner(btcFromAddr)

    let rawPreStxOpTx = '';

    return bsk.transactions.makeV2PreStxOp(dummySigner, undefined, true)
      .then((rawTx) => {
        if (btc.Transaction.fromHex(rawTx).outs.length != 2) {
          console.log("Pre-STX operation should have exactly two outputs");
          throw new Error('Pre-STX operation should have exactly two outputs, please fund a larger UTXO to consume');
        }
        console.log('=== Partially Signed Pre-STX operation tx ===')
        console.log(rawTx)
        rawPreStxOpTx = rawTx
        return rawTx
      })
      .then(tx => ({ tx, redeemScript }))
      .then(({ tx, redeemScript }) => {
        console.log('redeem script')
        console.log(redeemScript)
        return ({ tx, redeemScript })
      })
      .then(jsonOutput => Buff.from(JSON.stringify(jsonOutput))
            .toString('base64'))
      .then(payload => displayMessage('tx', `Payload: <br/> <br/> ${payload}`, 'Unsigned Pre-STX Operation Transaction'))
      .catch(err => {
        if (err.name === 'NotEnoughFundsError') {
          displayMessage('tx', `Not enough BTC funds to pay BTC fee. <br/> You should send a little over ${parseInt(err.leftToFund)*2} satoshis to ${btcFromAddr}`, 'ERROR')
        } else {
          displayMessage('tx', `Failed to generate transaction: <br/><br/> ${err}`, 'ERROR')
        }
        console.log(err)
      })
  })
}


function transact(buildIncomplete) {
  const device = getDevice()
  if (device == "ledger") {
    console.log("signing with ledger")
    return transactLedger(buildIncomplete)
  }
  console.log("signing with trezor")

  const path = getPath()

  const inputPayload = document.getElementById('transact-input').value.trim()

  const { tx, redeemScript } = JSON.parse(Buff.from(inputPayload, 'base64'))

  console.log('redeemscript')
  console.log(redeemScript)
  console.log('tx')
  console.log(tx)

  const txB = btc.TransactionBuilder.fromTransaction(
    btc.Transaction.fromHex(tx))

  return bskTrezor.TrezorMultiSigSigner.createSigner(path, redeemScript)
    .then(txSigner => {
      let signPromise = Promise.resolve()
      for (let i = 0; i < txB.__inputs.length; i++) {
        console.log('input')
        console.log(txB.__inputs[i])
        signPromise = signPromise.then(() => txSigner.signTransaction(txB, i))
      }
      return signPromise
    })
    .then(() => {
      const tx = buildIncomplete ? txB.buildIncomplete().toHex() : txB.build().toHex()
      console.log('== SIGNED TX ==')
      console.log(tx)
      if (buildIncomplete) {
        const jsonObj = { tx, redeemScript }
        const payload = Buff.from(JSON.stringify(jsonObj))
              .toString('base64')
        displayMessage('tx', payload, 'Partially Signed Transaction')
      } else {
        displayMessage('tx', tx, 'Signed Transaction')
      }
    })
    .catch(err => {
      displayMessage('tx', `Failed to sign transaction: <br/><br/> ${err}`, 'ERROR')
      console.log(err)
    })
}

function transactLedger(buildIncomplete) {
  const path = getPath()

  const inputPayload = document.getElementById('transact-input').value.trim()

  const { tx, redeemScript } = JSON.parse(Buff.from(inputPayload, 'base64'))

  const txB = btc.TransactionBuilder.fromTransaction(
    btc.Transaction.fromHex(tx))
  const signer = new bskLedger.LedgerMultiSigSigner(path, redeemScript, LedgerTransport);
  let signPromise = Promise.resolve()
  for (let i = 0; i < txB.__inputs.length; i++) {
    signPromise = signPromise.then(() => signer.signTransaction(txB, i))
  }
  return signPromise
    .then(() => {
      const tx = buildIncomplete ? txB.buildIncomplete().toHex() : txB.build().toHex()
      console.log('== SIGNED TX ==')
      console.log(tx)
      if (buildIncomplete) {
        const jsonObj = { tx, redeemScript }
        const payload = Buff.from(JSON.stringify(jsonObj))
              .toString('base64')
        displayMessage('tx', payload, 'Partially Signed Transaction')
      } else {
        displayMessage('tx', tx, 'Signed Transaction')
      }
    })
    .catch(err => {
      displayMessage('tx', `Failed to sign transaction: <br/><br/> ${err}`, 'ERROR')
      console.log(err)
    })
}
