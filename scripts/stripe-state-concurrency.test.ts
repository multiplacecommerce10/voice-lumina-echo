import { beforeEach, expect, mock, test } from 'bun:test';
let row:any=null; let notices:string[]=[]; let fail=false;
mock.module('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:()=>{const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:structuredClone(row),error:null})};return q},rpc:async(_name:string,p:any)=>{
 if(fail)return{error:{message:'fixture storage failure'}};
 if((row?.row_version??null)!==p.p_version)return{data:null,error:null};
 const prior=row;row={stripe_subscription_id:p.p_subscription,processed_invoice_ids:[],paid_invoice_count:0,paid_active_months:0,...row,...p.p_patch,row_version:(row?.row_version??0)+1};
 if(p.p_patch.last_invoice_id&&!prior?.processed_invoice_ids.includes(p.p_patch.last_invoice_id))notices.push(...(prior?.paid_invoice_count?['renewal']:['welcome','account']));
 return{data:structuredClone(row),error:null};
}}}));
const {applyInvoicePaid,applyInvoicePaymentFailed}=await import('../src/lib/subscription-state.server');
const sub={id:'sub_fixture',items:{data:[{price:{lookup_key:'complete_sub_3m_v1',recurring:{interval_count:3}},current_period_end:2000000000}]}};
const paid=(id:string)=>({env:'sandbox' as const,invoice:{id,subscription:sub.id,status_transitions:{paid_at:1900000000}},sub,eventId:'evt_'+id});
beforeEach(()=>{row=null;notices=[];fail=false});
test('same concurrent invoice grants exactly 3 months and one welcome/account pair',async()=>{await Promise.all([applyInvoicePaid(paid('in_a')),applyInvoicePaid(paid('in_a'))]);expect(row.paid_active_months).toBe(3);expect(row.paid_invoice_count).toBe(1);expect(notices).toEqual(['welcome','account'])});
test('distinct concurrent paid invoices preserve 6 months and one renewal',async()=>{await Promise.all([applyInvoicePaid(paid('in_a')),applyInvoicePaid(paid('in_b'))]);expect(row.paid_active_months).toBe(6);expect(row.paid_invoice_count).toBe(2);expect(notices).toEqual(['welcome','account','renewal'])});
test('database failure neither grants nor queues and retry succeeds once',async()=>{fail=true;await expect(applyInvoicePaid(paid('in_a'))).rejects.toThrow();expect(row).toBeNull();expect(notices).toHaveLength(0);fail=false;await applyInvoicePaid(paid('in_a'));expect(row.paid_active_months).toBe(3)});
test('late failed event for settled invoice cannot remove active access',async()=>{await applyInvoicePaid(paid('in_a'));await applyInvoicePaymentFailed(paid('in_a'));expect(row.access_status).toBe('active');expect(row.grace_expires_at).toBeNull()});
