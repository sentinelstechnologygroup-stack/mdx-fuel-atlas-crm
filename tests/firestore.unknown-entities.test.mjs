import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,deleteDoc,updateDoc} from 'firebase/firestore';

test('undeclared entity paths fail closed while declared shared access is preserved',async()=>{
 const [host,port]=(process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8080').split(':');
 const env=await initializeTestEnvironment({projectId:'demo-mdx-hardening',firestore:{host,port:Number(port),rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   for(const role of ['salesperson','super_admin'])await setDoc(doc(ctx.firestore(),'userProfiles',role),{application_role:role,account_status:'active',team_id:'one'});
   await setDoc(doc(ctx.firestore(),'entities/UndeclaredSecurityProbe/records/existing'),{synthetic:true});
  });
  for(const role of ['salesperson','super_admin']){
   const db=env.authenticatedContext(role).firestore(),ref=doc(db,'entities/UndeclaredSecurityProbe/records/existing');
   await assertFails(getDoc(ref));await assertFails(setDoc(doc(db,'entities/UndeclaredSecurityProbe/records/new'),{synthetic:true}));await assertFails(updateDoc(ref,{synthetic:false}));await assertFails(deleteDoc(ref));
   await assertSucceeds(setDoc(doc(db,'entities/ReportConfig/records/'+role),{name:'Synthetic report'}));
   await assertSucceeds(getDoc(doc(db,'entities/ReportConfig/records/'+role)));
   await assertFails(setDoc(doc(db,'userProfiles',role),{application_role:'super_admin'}));
   await assertFails(setDoc(doc(db,'entities/User/records/'+role),{role:'super_admin'}));
  }
  const guest=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(guest,'entities/ReportConfig/records/salesperson')));
 }finally{await env.cleanup();}
});
