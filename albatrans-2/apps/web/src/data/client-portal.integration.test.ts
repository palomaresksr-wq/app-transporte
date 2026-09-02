import { createClient } from "@supabase/supabase-js";
import { describe,expect,it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";

const enabled=process.env.PHASE_L_INTEGRATION==="true";
const run=enabled?describe:describe.skip;
run("client portal real Auth/RLS",()=>{
 it("isolates two customers and revokes access immediately",async()=>{
  const url=required("VITE_SUPABASE_URL"),anon=required("VITE_SUPABASE_ANON_KEY"),service=required("SUPABASE_SERVICE_ROLE_KEY"),password=required("PHASE_L_DEMO_PASSWORD");
  const admin=createClient<Database>(url,service,{auth:{persistSession:false}}),suffix=crypto.randomUUID().slice(0,8);
  const adminEmail=`phase-l-admin-${suffix}@albatrans.local`,aEmail=`client-a-${suffix}@albatrans.local`,bEmail=`client-b-${suffix}@albatrans.local`;
  const users: string[]=[];let org="",customerA="",customerB="";
  try{
   for(const email of [adminEmail,aEmail,bEmail]){const result=await admin.auth.admin.createUser({email,password,email_confirm:true});if(result.error||!result.data.user)throw result.error??new Error("Auth fixture failed");users.push(result.data.user.id);}
   const [adminId,aId,bId]=users;if(!adminId||!aId||!bId)throw new Error("Auth fixture incomplete");
   expect((await admin.from("profiles").insert([{user_id:adminId,display_name:"Admin L"},{user_id:aId,display_name:"Cliente A"},{user_id:bId,display_name:"Cliente B"}])).error).toBeNull();
   const createdOrg=await admin.from("organizations").insert({legal_name:`Demo Client Portal ${suffix}`,trade_name:"Demo Client Portal",tax_id:`L-${suffix}`,status:"active",created_by:adminId}).select("id").single();if(createdOrg.error)throw createdOrg.error;org=createdOrg.data.id;
   const plan=await admin.from("plans").select("id").eq("code","enterprise").single();if(plan.error)throw plan.error;
   if((await admin.from("organization_subscriptions").insert({organization_id:org,plan_id:plan.data.id,status:"active",payment_status:"paid",starts_at:new Date().toISOString()})).error)throw new Error("subscription fixture failed");
   const clients=await admin.from("clients").insert([{organization_id:org,legal_name:"Cliente A",trade_name:"Cliente A",created_by:adminId},{organization_id:org,legal_name:"Cliente B",trade_name:"Cliente B",created_by:adminId}]).select("id");if(clients.error||clients.data.length!==2)throw clients.error??new Error("client fixtures failed");customerA=clients.data[0]!.id;customerB=clients.data[1]!.id;
   if((await admin.from("client_portal_memberships").insert([{organization_id:org,customer_id:customerA,user_id:aId,role:"client_viewer",status:"active",created_by:adminId},{organization_id:org,customer_id:customerB,user_id:bId,role:"client_viewer",status:"active",created_by:adminId}])).error)throw new Error("membership fixtures failed");
   await admin.from("client_portal_visibility_policies").insert([{organization_id:org,customer_id:customerA,updated_by:adminId},{organization_id:org,customer_id:customerB,updated_by:adminId}]);
   await admin.from("transport_orders").insert([{organization_id:org,order_number:`L-A-${suffix}`,customer_id:customerA,transport_type:"general",status:"planned",created_by:adminId},{organization_id:org,order_number:`L-B-${suffix}`,customer_id:customerB,transport_type:"general",status:"planned",created_by:adminId}]);
   const clientA=createClient<Database>(url,anon,{auth:{persistSession:false}}),clientB=createClient<Database>(url,anon,{auth:{persistSession:false}});
   expect((await clientA.auth.signInWithPassword({email:aEmail,password})).error).toBeNull();expect((await clientB.auth.signInWithPassword({email:bEmail,password})).error).toBeNull();
   const directA=await Promise.all([
    clientA.from("clients").select("*"),clientA.from("locations").select("*"),clientA.from("vehicles").select("*"),
    clientA.from("transport_orders").select("*"),clientA.from("transport_stops").select("*"),clientA.from("transport_items").select("*"),
    clientA.from("transport_incidents").select("*"),clientA.from("transport_events").select("*"),clientA.from("documents").select("*"),
    clientA.from("document_versions").select("*"),clientA.from("proofs_of_delivery").select("*"),clientA.from("document_signatures").select("*"),
    clientA.from("invoices").select("*"),clientA.from("invoice_lines").select("*"),clientA.from("invoice_payments").select("*"),
    clientA.from("transport_regulatory_documents").select("*"),clientA.from("transport_regulatory_revisions").select("*"),
    clientA.from("transport_regulatory_evidence").select("*"),
   ]);
   for(const result of directA){expect(result.error).toBeNull();expect(result.data).toEqual([]);}
   expect((await clientB.from("transport_orders").select("*")).data).toEqual([]);
   const aPortal=await clientA.functions.invoke("client-portal",{body:{action:"transports"}}),bPortal=await clientB.functions.invoke("client-portal",{body:{action:"transports"}});expect(aPortal.error).toBeNull();expect(bPortal.error).toBeNull();expect(aPortal.data.items.map((x:{order_number:string})=>x.order_number)).toEqual([`L-A-${suffix}`]);expect(bPortal.data.items.map((x:{order_number:string})=>x.order_number)).toEqual([`L-B-${suffix}`]);
   const profile=await clientA.functions.invoke("client-portal",{body:{action:"profile"}});expect(profile.error).toBeNull();expect(Object.keys(profile.data).sort()).toEqual(["customerName","organizationName","policy","supportEmail","supportPhone"]);expect(Object.keys(profile.data.policy).sort()).toEqual(["actual_dates","goods_summary","incidents","invoices","planned_dates","pod","regulatory_documents","signatures","transport_status"]);
   const foreignOrderId=bPortal.data.items[0].id;const idor=await clientA.functions.invoke("client-portal",{body:{action:"transport_detail",orderId:foreignOrderId}});expect(idor.error).not.toBeNull();
   await admin.from("client_portal_memberships").update({status:"blocked"}).eq("user_id",aId);expect((await clientA.functions.invoke("client-portal",{body:{action:"transports"}})).error).not.toBeNull();
   await admin.from("client_portal_memberships").update({status:"active"}).eq("user_id",aId);
   await admin.from("profiles").update({status:"blocked"}).eq("user_id",aId);expect((await clientA.functions.invoke("client-portal",{body:{action:"transports"}})).error).not.toBeNull();await admin.from("profiles").update({status:"active"}).eq("user_id",aId);
   await admin.from("clients").update({status:"inactive"}).eq("id",customerA);expect((await clientA.functions.invoke("client-portal",{body:{action:"transports"}})).error).not.toBeNull();await admin.from("clients").update({status:"active"}).eq("id",customerA);
   await admin.from("organizations").update({status:"blocked",status_reason:"phase l integration"}).eq("id",org);expect((await clientA.functions.invoke("client-portal",{body:{action:"transports"}})).error).not.toBeNull();await admin.from("organizations").update({status:"active",status_reason:null}).eq("id",org);
   const module=await admin.from("modules").select("id").eq("code","client_portal").single();if(module.error)throw module.error;await admin.from("organization_module_overrides").insert({organization_id:org,module_id:module.data.id,override_mode:"disabled",reason:"phase l integration",changed_by:adminId});expect((await clientA.functions.invoke("client-portal",{body:{action:"transports"}})).error).not.toBeNull();await admin.from("organization_module_overrides").delete().eq("organization_id",org).eq("module_id",module.data.id);expect((await clientA.functions.invoke("client-portal",{body:{action:"transports"}})).error).toBeNull();
  }finally{
   if(org){await admin.from("organization_module_overrides").delete().eq("organization_id",org);await admin.from("transport_orders").delete().eq("organization_id",org);await admin.from("client_portal_visibility_policies").delete().eq("organization_id",org);await admin.from("client_portal_memberships").delete().eq("organization_id",org);await admin.from("clients").delete().eq("organization_id",org);await admin.from("organization_subscriptions").delete().eq("organization_id",org);await admin.from("organizations").delete().eq("id",org);}
   if(users.length)await admin.from("profiles").delete().in("user_id",users);for(const id of users)await admin.auth.admin.deleteUser(id);
  }
 });
});
function required(name:string){const value=process.env[name];if(!value)throw new Error(`${name} required`);return value;}
