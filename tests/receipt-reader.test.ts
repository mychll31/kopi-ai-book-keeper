import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt } from '../src/lib/receipt-reader.ts';
const receipt = {is_receipt:true,details_clear:true,currency:'PHP',date:'2026-09-10',amount:'12.34',description:'Lunch',category:'Food',direction:'debit',direction_clear:true};
test('receipt validation rejects guessed totals, invalid dates and currency', () => {
  for(const change of [{is_receipt:false},{details_clear:false},{currency:'USD'},{date:'2026-02-30'},{amount:'0'},{amount:'12.345'},{amount:12.34},{description:''},{payment_status:'pending'},{payment_status:'failed'},{amount:'4,22.00'}]) assert.throws(()=>parseReceipt({...receipt,...change},['Food']));
});
test('Grab payment screenshot is a 422-peso debit using account currency',()=>{
  const result=parseReceipt({...receipt,currency:null,payment_label:'Payment to Grab Philippines',description:'Payment to Grab Philippines',amount:'−422.00',direction:null,direction_clear:false},['Transport']);
  assert.equal(result.type,'debit');assert.equal(result.amount,42200);assert.equal(result.date,'2026-09-10');assert.equal(result.confident,true);
});
test('received payments stay credit; conflicting direction requires confirmation',()=>{
  assert.equal(parseReceipt({...receipt,payment_label:'Payment from Jane',direction:'credit'},[]).type,'credit');
  assert.equal(parseReceipt({...receipt,payment_label:'Payment received',amount:'-422.00',direction:'credit'},[]).confident,false);
  assert.equal(parseReceipt({...receipt,payment_label:'Payment',direction:null,direction_clear:false},[]).confident,false);
  assert.equal(parseReceipt({...receipt,amount:'1,422.00'},[]).amount,142200);
});
test('uncertain direction stays pending; unknown category is uncategorized', () => {
  assert.equal(parseReceipt({...receipt,direction_clear:false},['Food']).confident,false);
  assert.equal(parseReceipt({...receipt,direction:'unknown'},['Food']).type,null);
  assert.equal(parseReceipt({...receipt,category:'Invented'},['Food']).subscription,'');
  assert.equal(parseReceipt(receipt,['Food']).amount,1234);
});
