'use strict';

import SparseMerkle from 'lib/SparseMerkle';

import { PlasmaTransaction } from 'lib/model/tx';
import RLP from 'rlp';
import ethUtil from 'ethereumjs-util';
import { removeHexPrefix } from 'lib/helpers/utills';

class Block {
  constructor (data) {
    if (Buffer.isBuffer(data)) {
      let decodedData = RLP.decode(data);
      this.blockNumber = decodedData && decodedData[0];
      this.merkleRootHash = decodedData && decodedData[1];
      this.transactions = decodedData && decodedData[2];
    
    } else if (data && typeof data === 'object') {
      this.blockNumber = data.blockNumber;
      this.transactions = data.transactions || [];

      let leaves = this.transactions.map(tx => {
        return { key: tx.token_id, hash: tx.getHash() };
      });

      this.merkle = new SparseMerkle(leaves);
      this.merkle.buildTree();
      this.merkleRootHash = this.merkle.getMerkleRoot();
    }
  }

  getRlp() {
    if (this._rlp) {
      return this._rlp;
    }
    let transactions = this.transactions;
    if (transactions[0] && transactions[0] instanceof PlasmaTransaction) {
      transactions = transactions.map(tx => tx.getRaw());
    }

    this._rlp = RLP.encode([this.blockNumber, this.merkleRootHash, transactions]);
    return this._rlp;
  }

  toJson() {
    let data = [
      this.blockNumber,
      this.merkleRootHash,
      this.transactions
    ];

    return ethUtil.baToJSON(data);
  }
  
  getProof(token_id, returnhex) {  
    if (!this.merkle) {
      this.buildTree();
    }
    
    return this.merkle.getProof(token_id, returnhex);
  }
    
  checkProof(proof, hash) {  
    if (!this.merkle) {
      this.buildTree();
    }
    
    return this.merkle.checkProof(proof, hash, this.merkleRootHash);
  }
  
  buildTree() {
    if (this.transactions[0] && !(this.transactions[0] instanceof PlasmaTransaction)) {
      this.transactions = this.transactions.map(tx => new PlasmaTransaction(tx));
    }
    let leaves = this.transactions.map(tx => {
      return { key: tx.token_id, hash: tx.getHash() };
    });

    this.merkle = new SparseMerkle(leaves);
    this.merkle.buildTree();
    this.merkleRootHash = this.merkle.getMerkleRoot();
  }

  
  getJson() {
    let data = {
      blockNumber: ethUtil.bufferToInt(this.blockNumber.toString()),
      merkleRootHash: this.merkleRootHash.toString('hex'),
    };
    
    let transactions = this.transactions;

    if (transactions[0] && !(transactions[0] instanceof PlasmaTransaction)) {
      transactions = transactions.map(tx => (new PlasmaTransaction(tx)).getJson());
    } else {
      transactions = transactions.map(tx => tx.getJson());
    }
    
    data.transactions = transactions;
    return data;
  }
  
  getTxByTokenId(token_id) {
    let transaction;
    if (!(token_id instanceof Buffer)) {
      token_id = ethUtil.toBuffer(removeHexPrefix(token_id));
    }
    let txsAreRlp = this.transactions[0] && !(this.transactions[0] instanceof PlasmaTransaction);
    let txsTokenIdKey = txsAreRlp ? 2 : 'token_id';
    transaction = this.transactions.find(tx => tx && token_id.equals(tx[txsTokenIdKey]));

    if (transaction && !(transaction instanceof PlasmaTransaction)) {
      transaction = new PlasmaTransaction(transaction);
    }
    
    return transaction;
  }
}

module.exports = Block;
