-- Fase H: facturación fiscal básica. Aditiva; no afirma certificación fiscal española.
create type public.invoice_status as enum ('draft','issued','partially_paid','paid','overdue','cancelled','rectified');
create type public.invoice_payment_method as enum ('bank_transfer','cash','card','direct_debit','other');
create type public.invoice_tax_kind as enum ('standard','reduced','super_reduced','zero','exempt');
create type public.invoice_fiscal_year_mode as enum ('calendar_year','continuous');

create table public.billing_fiscal_settings(
 organization_id uuid primary key references public.organizations(id) on delete restrict,
 legal_name text not null, tax_id text not null, address_line_1 text not null, address_line_2 text,
 postal_code text not null, city text not null, region text, country_code text not null default 'ES',
 billing_email text, default_payment_terms_days integer not null default 30 check(default_payment_terms_days between 0 and 3650),
 updated_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(btrim(legal_name)<>'' and btrim(tax_id)<>'' and btrim(address_line_1)<>'' and btrim(postal_code)<>'' and btrim(city)<>'')
);
create table public.invoice_taxes(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 code text not null, name text not null, kind public.invoice_tax_kind not null, rate numeric(7,4) not null check(rate between 0 and 100),
 exemption_reason text, active boolean not null default true, created_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(btrim(code)<>'' and btrim(name)<>''), check((kind='exempt')=(rate=0 and exemption_reason is not null))
);
create unique index invoice_taxes_code_unique on public.invoice_taxes(organization_id,lower(code));
create table public.invoice_series(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 code text not null, name text not null, prefix text not null, next_number bigint not null default 1 check(next_number>=1),
 active boolean not null default true, is_primary boolean not null default false,
 fiscal_year_mode public.invoice_fiscal_year_mode not null default 'calendar_year',
 created_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(code~'^[A-Z0-9_-]{1,20}$' and btrim(name)<>'' and prefix~'^[A-Z0-9_-]{1,30}$')
);
create unique index invoice_series_code_unique on public.invoice_series(organization_id,lower(code));
create unique index invoice_series_primary_unique on public.invoice_series(organization_id) where is_primary;

create table public.invoices(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 invoice_series_id uuid not null references public.invoice_series(id) on delete restrict, invoice_number text not null,
 issue_date date not null, service_period_start date, service_period_end date, customer_id uuid not null references public.clients(id) on delete restrict,
 status public.invoice_status not null, currency_code text not null default 'EUR' check(currency_code~'^[A-Z]{3}$'),
 subtotal numeric(14,2) not null, tax_total numeric(14,2) not null, total numeric(14,2) not null,
 amount_paid numeric(14,2) not null default 0, amount_due numeric(14,2) not null,
 due_date date, payment_terms_days integer not null default 0 check(payment_terms_days between 0 and 3650), notes text,
 preinvoice_id uuid references public.billing_preinvoices(id) on delete restrict,
 created_by uuid not null references public.profiles(user_id) on delete restrict, created_at timestamptz not null default now(),
 issued_by uuid references public.profiles(user_id) on delete restrict, issued_at timestamptz,
 cancelled_by uuid references public.profiles(user_id) on delete restrict, cancelled_at timestamptz, cancellation_reason text,
 rectified_invoice_id uuid references public.invoices(id) on delete restrict,
 fiscal_snapshot_json jsonb not null check(jsonb_typeof(fiscal_snapshot_json)='object'),
 billing_snapshot_json jsonb not null check(jsonb_typeof(billing_snapshot_json)='object'),
 correlation_id uuid not null, idempotency_key uuid not null,
 check(service_period_end is null or service_period_start is null or service_period_end>=service_period_start),
 check(total=round(subtotal+tax_total,2)), check(amount_due=round(total-amount_paid,2)), check(amount_paid>=0),
 check((cancelled_at is null and cancelled_by is null and cancellation_reason is null) or (cancelled_at is not null and cancelled_by is not null and btrim(cancellation_reason)<>''))
);
create unique index invoices_number_unique on public.invoices(organization_id,invoice_number);
create unique index invoices_key_unique on public.invoices(organization_id,idempotency_key);
create unique index invoices_preinvoice_unique on public.invoices(preinvoice_id) where preinvoice_id is not null;
create unique index invoices_single_rectification_unique on public.invoices(rectified_invoice_id) where rectified_invoice_id is not null and status<>'cancelled';
create index invoices_list_idx on public.invoices(organization_id,status,issue_date desc);
create table public.invoice_lines(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 invoice_id uuid not null references public.invoices(id) on delete restrict, position integer not null check(position>0), description text not null,
 quantity numeric(14,4) not null check(quantity<>0), unit_price numeric(14,4) not null,
 subtotal numeric(14,2) not null, tax_id uuid references public.invoice_taxes(id) on delete restrict,
 tax_code text not null, tax_name text not null, tax_kind public.invoice_tax_kind not null, tax_rate numeric(7,4) not null,
 tax_amount numeric(14,2) not null, total numeric(14,2) not null,
 transport_order_id uuid references public.transport_orders(id) on delete restrict,
 valuation_id uuid references public.transport_order_valuations(id) on delete restrict,
 snapshot_json jsonb not null check(jsonb_typeof(snapshot_json)='object'), created_at timestamptz not null default now(),
 unique(invoice_id,position), check(btrim(description)<>''), check(subtotal=round(quantity*unit_price,2)),
 check(tax_amount=round(subtotal*tax_rate/100,2)), check(total=round(subtotal+tax_amount,2))
);
create table public.invoice_payments(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 invoice_id uuid not null references public.invoices(id) on delete restrict, amount numeric(14,2) not null check(amount>0),
 payment_date date not null, method public.invoice_payment_method not null, reference text, notes text,
 created_by uuid not null references public.profiles(user_id) on delete restrict, created_at timestamptz not null default now(),
 correlation_id uuid not null, idempotency_key uuid not null
);
create unique index invoice_payments_key_unique on public.invoice_payments(organization_id,idempotency_key);
alter table public.documents add column invoice_id uuid references public.invoices(id) on delete restrict;
create index documents_invoice_idx on public.documents(organization_id,invoice_id) where invoice_id is not null;
alter table public.documents drop constraint document_has_relation;
alter table public.documents add constraint document_has_relation check(num_nonnulls(transport_order_id,transport_stop_id,transport_incident_id,client_id,vehicle_id,driver_id,invoice_id)>0);

create table public.invoice_command_idempotency(
 organization_id uuid not null references public.organizations(id) on delete restrict,
 idempotency_key uuid not null, command text not null, request_hash text not null,
 result jsonb, actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), completed_at timestamptz,
 primary key(organization_id,idempotency_key),
 check(command in('cancel_invoice','create_corrective_invoice','generate_invoice_pdf')),
 check(request_hash~'^[0-9a-f]{32}$'), check(result is null or jsonb_typeof(result)='object')
);

create function public.invoice_tenant_guard() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_org uuid;
begin
 if tg_table_name='invoice_lines' then select organization_id into v_org from public.invoices where id=new.invoice_id;
 elsif tg_table_name='invoice_payments' then select organization_id into v_org from public.invoices where id=new.invoice_id;
 elsif tg_table_name='documents' then if new.invoice_id is null then return new;end if;select organization_id into v_org from public.invoices where id=new.invoice_id;
 elsif tg_table_name='invoices' then select organization_id into v_org from public.clients where id=new.customer_id;
 else return new; end if;
 if v_org is distinct from new.organization_id then raise exception using errcode='23514',message='invoice tenant mismatch'; end if; return new;
end$$;
create trigger invoices_tenant before insert or update on public.invoices for each row execute function public.invoice_tenant_guard();
create trigger invoice_lines_tenant before insert or update on public.invoice_lines for each row execute function public.invoice_tenant_guard();
create trigger invoice_payments_tenant before insert or update on public.invoice_payments for each row execute function public.invoice_tenant_guard();
create trigger documents_invoice_tenant before insert or update of invoice_id on public.documents for each row execute function public.invoice_tenant_guard();

create function public.prevent_issued_invoice_mutation() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then raise exception using errcode='55000',message='fiscal records cannot be deleted'; end if;
 if tg_table_name='invoice_payments' then raise exception using errcode='55000',message='invoice payments are append-only';
 elsif tg_table_name='invoice_lines' then raise exception using errcode='55000',message='issued invoice lines are immutable';
 elsif tg_table_name='invoices' then
  if old.status<>'draft' and (new.invoice_number,new.issue_date,new.customer_id,new.subtotal,new.tax_total,new.total,new.fiscal_snapshot_json,new.billing_snapshot_json,new.invoice_series_id) is distinct from (old.invoice_number,old.issue_date,old.customer_id,old.subtotal,old.tax_total,old.total,old.fiscal_snapshot_json,old.billing_snapshot_json,old.invoice_series_id) then raise exception using errcode='55000',message='issued invoice fiscal data is immutable'; end if;
 end if;
 return new;
end$$;
create trigger invoices_immutable before update or delete on public.invoices for each row execute function public.prevent_issued_invoice_mutation();
create trigger invoice_lines_immutable before update or delete on public.invoice_lines for each row execute function public.prevent_issued_invoice_mutation();
create trigger invoice_payments_no_mutation before update or delete on public.invoice_payments for each row execute function public.prevent_issued_invoice_mutation();

create function public.next_invoice_number(p_org uuid,p_series uuid,p_issue_date date) returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.invoice_series%rowtype; n bigint; year_text text;
begin select * into v from public.invoice_series where id=p_series and organization_id=p_org and active for update; if not found then raise exception using errcode='P0002',message='invoice series not found'; end if; n=v.next_number; update public.invoice_series set next_number=n+1,updated_at=statement_timestamp() where id=v.id; year_text:=case when v.fiscal_year_mode='calendar_year' then '-'||extract(year from p_issue_date)::text else '' end; return v.prefix||year_text||'-'||lpad(n::text,6,'0'); end$$;

create function public.issue_preinvoice_invoice(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_preinvoice uuid,p_series uuid,p_issue_date date,p_tax uuid,p_due_date date,p_notes text,p_correlation uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare pre public.billing_preinvoices%rowtype; cfg public.billing_fiscal_settings%rowtype; client public.clients%rowtype; tax public.invoice_taxes%rowtype; inv uuid; num text; sub numeric(14,2); vat numeric(14,2); tot numeric(14,2); existing public.invoices%rowtype; line record; pos int:=0; result jsonb;
begin
 if not public.billing_actor_authorized(p_actor,p_scope,p_org,true) then raise exception using errcode='42501',message='billing actor not authorized'; end if;
 select * into existing from public.invoices where organization_id=p_org and idempotency_key=p_key; if found then if existing.preinvoice_id<>p_preinvoice or existing.invoice_series_id<>p_series then raise exception using errcode='23505',message='idempotency key reused with different payload'; end if; return jsonb_build_object('ok',true,'invoiceId',existing.id,'invoiceNumber',existing.invoice_number,'total',existing.total,'status',existing.status); end if;
 select * into pre from public.billing_preinvoices where id=p_preinvoice and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='preinvoice not found'; end if;
 select * into existing from public.invoices where organization_id=p_org and idempotency_key=p_key;if found then return jsonb_build_object('ok',true,'invoiceId',existing.id,'invoiceNumber',existing.invoice_number,'total',existing.total,'status',existing.status);end if;if pre.status<>'approved' then raise exception using errcode='22023',message='only approved preinvoices can be converted'; end if;
 select * into cfg from public.billing_fiscal_settings where organization_id=p_org; if not found then raise exception using errcode='22023',message='fiscal settings are required'; end if;
 select * into client from public.clients where id=pre.client_id and organization_id=p_org; select * into tax from public.invoice_taxes where id=p_tax and organization_id=p_org and active; if not found then raise exception using errcode='P0002',message='tax not found'; end if;
 sub:=pre.total_amount; vat:=round(sub*tax.rate/100,2); tot:=sub+vat; num:=public.next_invoice_number(p_org,p_series,p_issue_date);
 insert into public.invoices(organization_id,invoice_series_id,invoice_number,issue_date,service_period_start,service_period_end,customer_id,status,currency_code,subtotal,tax_total,total,amount_due,due_date,payment_terms_days,notes,preinvoice_id,created_by,issued_by,issued_at,fiscal_snapshot_json,billing_snapshot_json,correlation_id,idempotency_key)
 values(p_org,p_series,num,p_issue_date,pre.period_start,pre.period_end,pre.client_id,'issued',pre.currency_code,sub,vat,tot,tot,p_due_date,coalesce(p_due_date-p_issue_date,0),nullif(btrim(coalesce(p_notes,'')),''),pre.id,p_actor,p_actor,statement_timestamp(),jsonb_build_object('issuer',jsonb_build_object('legalName',cfg.legal_name,'taxId',cfg.tax_id,'addressLine1',cfg.address_line_1,'addressLine2',cfg.address_line_2,'postalCode',cfg.postal_code,'city',cfg.city,'region',cfg.region,'countryCode',cfg.country_code,'email',cfg.billing_email),'customer',jsonb_build_object('legalName',client.legal_name,'tradeName',client.trade_name,'taxId',client.tax_id,'email',client.billing_email),'tax',jsonb_build_object('code',tax.code,'name',tax.name,'kind',tax.kind,'rate',tax.rate,'exemptionReason',tax.exemption_reason)),jsonb_build_object('preinvoiceId',pre.id,'reference',pre.reference,'subtotal',sub),p_correlation,p_key) returning id into inv;
 for line in select l.*,o.order_number from public.billing_preinvoice_lines l join public.transport_orders o on o.id=l.transport_order_id where l.preinvoice_id=pre.id and l.removed_at is null order by l.created_at loop pos:=pos+1; insert into public.invoice_lines(organization_id,invoice_id,position,description,quantity,unit_price,subtotal,tax_id,tax_code,tax_name,tax_kind,tax_rate,tax_amount,total,transport_order_id,valuation_id,snapshot_json) values(p_org,inv,pos,line.description,1,line.line_amount,line.line_amount,tax.id,tax.code,tax.name,tax.kind,tax.rate,round(line.line_amount*tax.rate/100,2),round(line.line_amount*(1+tax.rate/100),2),line.transport_order_id,line.valuation_id,jsonb_build_object('orderNumber',line.order_number,'valuationId',line.valuation_id,'preinvoiceLineId',line.id)); update public.transport_orders set economic_status='invoiced',updated_at=statement_timestamp() where id=line.transport_order_id; insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,line.transport_order_id,'billing.invoice_issued',p_actor,'invoice',inv,jsonb_build_object('invoiceId',inv,'invoiceNumber',num,'amount',tot),p_correlation); end loop;
 update public.billing_preinvoices set status='converted',updated_at=statement_timestamp() where id=pre.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'billing.invoice_issued','invoice',inv::text,jsonb_build_object('invoiceNumber',num,'preinvoiceId',pre.id,'total',tot,'currency',pre.currency_code),p_correlation);
 result:=jsonb_build_object('ok',true,'invoiceId',inv,'invoiceNumber',num,'subtotal',sub,'taxTotal',vat,'total',tot,'status','issued'); return result;
end$$;

create function public.record_invoice_payment(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_invoice uuid,p_amount numeric,p_date date,p_method public.invoice_payment_method,p_reference text,p_notes text,p_correlation uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare inv public.invoices%rowtype; payment uuid; paid numeric; new_status public.invoice_status; existing public.invoice_payments%rowtype;
begin if not public.billing_actor_authorized(p_actor,p_scope,p_org,true) then raise exception using errcode='42501',message='billing actor not authorized'; end if; select * into existing from public.invoice_payments where organization_id=p_org and idempotency_key=p_key; if found then if existing.invoice_id<>p_invoice or existing.amount<>p_amount then raise exception using errcode='23505',message='idempotency key reused with different payload'; end if; return jsonb_build_object('ok',true,'paymentId',existing.id); end if; select * into inv from public.invoices where id=p_invoice and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='invoice not found'; end if;select * into existing from public.invoice_payments where organization_id=p_org and idempotency_key=p_key;if found then return jsonb_build_object('ok',true,'paymentId',existing.id);end if; if inv.status not in('issued','partially_paid','overdue') then raise exception using errcode='22023',message='invoice cannot receive payments'; end if; if p_amount<=0 or p_amount>inv.amount_due then raise exception using errcode='22023',message='payment exceeds amount due'; end if; insert into public.invoice_payments(organization_id,invoice_id,amount,payment_date,method,reference,notes,created_by,correlation_id,idempotency_key) values(p_org,p_invoice,round(p_amount,2),p_date,p_method,nullif(btrim(coalesce(p_reference,'')),''),nullif(btrim(coalesce(p_notes,'')),''),p_actor,p_correlation,p_key) returning id into payment; paid:=inv.amount_paid+round(p_amount,2);new_status:=case when paid=inv.total then 'paid'::public.invoice_status else 'partially_paid'::public.invoice_status end; update public.invoices set amount_paid=paid,amount_due=total-paid,status=new_status where id=inv.id; insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'billing.invoice_payment_recorded','invoice',inv.id::text,jsonb_build_object('paymentId',payment,'amount',round(p_amount,2),'amountPaid',paid,'amountDue',inv.total-paid,'method',p_method),p_correlation); if new_status='paid' then insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'billing.invoice_paid','invoice',inv.id::text,jsonb_build_object('invoiceNumber',inv.invoice_number,'total',inv.total),p_correlation); end if; return jsonb_build_object('ok',true,'paymentId',payment,'status',new_status,'amountPaid',paid,'amountDue',inv.total-paid); end$$;

create function public.cancel_invoice(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_invoice uuid,p_reason text,p_correlation uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare inv public.invoices%rowtype; old public.invoice_command_idempotency%rowtype; h text:=md5(p_invoice::text||'|'||btrim(coalesce(p_reason,''))); result jsonb;
begin
 if not public.billing_actor_authorized(p_actor,p_scope,p_org,true) then raise exception using errcode='42501',message='billing actor not authorized';end if;
 select * into old from public.invoice_command_idempotency where organization_id=p_org and idempotency_key=p_key for update;
 if found then if old.command<>'cancel_invoice' or old.request_hash<>h then raise exception using errcode='23505',message='idempotency key reused with different payload';end if;return old.result;end if;
 insert into public.invoice_command_idempotency values(p_org,p_key,'cancel_invoice',h,null,p_actor,now(),null);
 select * into inv from public.invoices where id=p_invoice and organization_id=p_org for update;if not found then raise exception using errcode='P0002',message='invoice not found';end if;
 if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception using errcode='22023',message='cancellation reason is required';end if;
 if inv.status not in('draft','issued','overdue') or inv.amount_paid<>0 then raise exception using errcode='22023',message='issued or paid invoice requires corrective invoice';end if;
 update public.invoices set status='cancelled',cancelled_by=p_actor,cancelled_at=statement_timestamp(),cancellation_reason=btrim(p_reason) where id=inv.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,reason,correlation_id) values(p_org,p_actor,p_scope,'billing.invoice_cancelled','invoice',inv.id::text,jsonb_build_object('invoiceNumber',inv.invoice_number),btrim(p_reason),p_correlation);
 result:=jsonb_build_object('ok',true,'invoiceId',inv.id,'status','cancelled');update public.invoice_command_idempotency set result=result,completed_at=statement_timestamp() where organization_id=p_org and idempotency_key=p_key;return result;
end$$;

create function public.configure_invoice_fiscal(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_settings jsonb,p_series jsonb,p_taxes jsonb,p_correlation uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare s uuid; t jsonb; tax_id uuid;
begin
 if not public.billing_actor_authorized(p_actor,p_scope,p_org,true) then raise exception using errcode='42501',message='billing actor not authorized';end if;
 insert into public.billing_fiscal_settings(organization_id,legal_name,tax_id,address_line_1,address_line_2,postal_code,city,region,country_code,billing_email,default_payment_terms_days,updated_by)
 values(p_org,btrim(p_settings->>'legalName'),btrim(p_settings->>'taxId'),btrim(p_settings->>'addressLine1'),nullif(btrim(p_settings->>'addressLine2'),''),btrim(p_settings->>'postalCode'),btrim(p_settings->>'city'),nullif(btrim(p_settings->>'region'),''),coalesce(nullif(btrim(p_settings->>'countryCode'),''),'ES'),nullif(btrim(p_settings->>'billingEmail'),''),coalesce((p_settings->>'defaultPaymentTermsDays')::int,30),p_actor)
 on conflict(organization_id) do update set legal_name=excluded.legal_name,tax_id=excluded.tax_id,address_line_1=excluded.address_line_1,address_line_2=excluded.address_line_2,postal_code=excluded.postal_code,city=excluded.city,region=excluded.region,country_code=excluded.country_code,billing_email=excluded.billing_email,default_payment_terms_days=excluded.default_payment_terms_days,updated_by=p_actor,updated_at=statement_timestamp();
 if coalesce((p_series->>'isPrimary')::boolean,true) then update public.invoice_series set is_primary=false,updated_at=statement_timestamp() where organization_id=p_org and is_primary;end if;
 insert into public.invoice_series(organization_id,code,name,prefix,next_number,active,is_primary,fiscal_year_mode,created_by)
 values(p_org,upper(btrim(p_series->>'code')),btrim(p_series->>'name'),upper(btrim(p_series->>'prefix')),coalesce((p_series->>'nextNumber')::bigint,1),true,coalesce((p_series->>'isPrimary')::boolean,true),coalesce((p_series->>'fiscalYearMode')::public.invoice_fiscal_year_mode,'calendar_year'),p_actor)
 on conflict(organization_id,(lower(code))) do update set name=excluded.name,prefix=excluded.prefix,active=true,is_primary=excluded.is_primary,fiscal_year_mode=excluded.fiscal_year_mode,updated_at=statement_timestamp() returning id into s;
 for t in select value from jsonb_array_elements(coalesce(p_taxes,'[]')) loop
  insert into public.invoice_taxes(organization_id,code,name,kind,rate,exemption_reason,active,created_by)
  values(p_org,upper(btrim(t->>'code')),btrim(t->>'name'),(t->>'kind')::public.invoice_tax_kind,(t->>'rate')::numeric,nullif(btrim(t->>'exemptionReason'),''),coalesce((t->>'active')::boolean,true),p_actor)
  on conflict(organization_id,(lower(code))) do update set name=excluded.name,kind=excluded.kind,rate=excluded.rate,exemption_reason=excluded.exemption_reason,active=excluded.active,updated_at=statement_timestamp() returning id into tax_id;
 end loop;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'billing.fiscal_settings_updated','organization',p_org::text,jsonb_build_object('seriesId',s,'taxCount',jsonb_array_length(coalesce(p_taxes,'[]'))),p_correlation);
 return jsonb_build_object('ok',true,'seriesId',s);
end$$;

create function public.create_corrective_invoice(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_invoice uuid,p_series uuid,p_subtotal numeric,p_reason text,p_issue_date date,p_correlation uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare original public.invoices%rowtype; line public.invoice_lines%rowtype; existing public.invoices%rowtype; inv uuid; num text; sub numeric(14,2); vat numeric(14,2); tot numeric(14,2);
begin
 if not public.billing_actor_authorized(p_actor,p_scope,p_org,true) then raise exception using errcode='42501',message='billing actor not authorized';end if;
 select * into existing from public.invoices where organization_id=p_org and idempotency_key=p_key;if found then if existing.rectified_invoice_id<>p_invoice then raise exception using errcode='23505',message='idempotency key reused with different payload';end if;return jsonb_build_object('ok',true,'invoiceId',existing.id,'invoiceNumber',existing.invoice_number,'total',existing.total);end if;
 select * into original from public.invoices where id=p_invoice and organization_id=p_org for update;if not found then raise exception using errcode='P0002',message='invoice not found';end if;
 if original.status not in('issued','partially_paid','paid','overdue') then raise exception using errcode='22023',message='invoice cannot be rectified';end if;
 if p_subtotal<=0 or p_subtotal>original.subtotal or nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception using errcode='22023',message='invalid corrective amount or reason';end if;
 select * into line from public.invoice_lines where invoice_id=original.id order by position limit 1;
 sub:=-round(p_subtotal,2);vat:=round(sub*line.tax_rate/100,2);tot:=sub+vat;num:=public.next_invoice_number(p_org,p_series,p_issue_date);
 insert into public.invoices(organization_id,invoice_series_id,invoice_number,issue_date,customer_id,status,currency_code,subtotal,tax_total,total,amount_due,payment_terms_days,notes,created_by,issued_by,issued_at,rectified_invoice_id,fiscal_snapshot_json,billing_snapshot_json,correlation_id,idempotency_key)
 values(p_org,p_series,num,p_issue_date,original.customer_id,'issued',original.currency_code,sub,vat,tot,tot,0,btrim(p_reason),p_actor,p_actor,statement_timestamp(),original.id,original.fiscal_snapshot_json,jsonb_build_object('rectifiedInvoiceId',original.id,'rectifiedInvoiceNumber',original.invoice_number,'reason',btrim(p_reason),'partial',p_subtotal<original.subtotal),p_correlation,p_key) returning id into inv;
 insert into public.invoice_lines(organization_id,invoice_id,position,description,quantity,unit_price,subtotal,tax_id,tax_code,tax_name,tax_kind,tax_rate,tax_amount,total,snapshot_json)
 values(p_org,inv,1,'Rectificacion de '||original.invoice_number,-1,p_subtotal,sub,line.tax_id,line.tax_code,line.tax_name,line.tax_kind,line.tax_rate,vat,tot,jsonb_build_object('originalInvoiceId',original.id,'reason',btrim(p_reason)));
 update public.invoices set status='rectified' where id=original.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,reason,correlation_id) values(p_org,p_actor,p_scope,'billing.credit_invoice_created','invoice',inv::text,jsonb_build_object('invoiceNumber',num,'rectifiedInvoiceId',original.id,'total',tot),btrim(p_reason),p_correlation);
 return jsonb_build_object('ok',true,'invoiceId',inv,'invoiceNumber',num,'subtotal',sub,'taxTotal',vat,'total',tot,'status','issued');
end$$;

create function public.mark_invoice_overdue(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_invoice uuid,p_correlation uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare inv public.invoices%rowtype;
begin if not public.billing_actor_authorized(p_actor,p_scope,p_org,true) then raise exception using errcode='42501',message='billing actor not authorized';end if;select * into inv from public.invoices where id=p_invoice and organization_id=p_org for update;if not found then raise exception using errcode='P0002',message='invoice not found';end if;if inv.status not in('issued','partially_paid') or inv.amount_due<=0 or inv.due_date is null or inv.due_date>=current_date then raise exception using errcode='22023',message='invoice is not overdue';end if;update public.invoices set status='overdue' where id=inv.id;insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'billing.invoice_overdue','invoice',inv.id::text,jsonb_build_object('invoiceNumber',inv.invoice_number,'dueDate',inv.due_date,'amountDue',inv.amount_due),p_correlation);return jsonb_build_object('ok',true,'invoiceId',inv.id,'status','overdue');end$$;

create function public.begin_invoice_pdf(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_invoice uuid,p_size bigint,p_sha256 text,p_correlation uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare inv public.invoices%rowtype; old public.invoice_command_idempotency%rowtype; doc uuid; ver uuid; path text; h text:=md5(p_invoice::text||'|'||p_size::text||'|'||p_sha256); result jsonb;
begin
 if not public.billing_actor_authorized(p_actor,p_scope,p_org,true) then raise exception using errcode='42501',message='billing actor not authorized';end if;if p_size<=0 or p_size>10485760 or p_sha256!~'^[0-9a-f]{64}$' then raise exception using errcode='22023',message='invalid PDF metadata';end if;
 select * into old from public.invoice_command_idempotency where organization_id=p_org and idempotency_key=p_key for update;if found then if old.command<>'generate_invoice_pdf' or old.request_hash<>h then raise exception using errcode='23505',message='idempotency key reused with different payload';end if;return old.result;end if;
 select * into inv from public.invoices where id=p_invoice and organization_id=p_org;if not found then raise exception using errcode='P0002',message='invoice not found';end if;
 doc:=gen_random_uuid();ver:=gen_random_uuid();path:=p_org::text||'/invoices/'||p_invoice::text||'/'||ver::text||'.pdf';
 insert into public.invoice_command_idempotency values(p_org,p_key,'generate_invoice_pdf',h,null,p_actor,now(),null);
 insert into public.documents(id,organization_id,invoice_id,document_type,title,status,source,created_by) values(doc,p_org,p_invoice,'invoice_pdf','Factura '||inv.invoice_number,'pending_upload','generated',p_actor);
 insert into public.document_versions(id,organization_id,document_id,version_number,storage_bucket,storage_path,original_filename,mime_type,size_bytes,uploaded_by,status) values(ver,p_org,doc,1,'albatrans-documents',path,inv.invoice_number||'.pdf','application/pdf',p_size,p_actor,'pending_upload');
 result:=jsonb_build_object('ok',true,'documentId',doc,'versionId',ver,'storagePath',path);update public.invoice_command_idempotency set result=result where organization_id=p_org and idempotency_key=p_key;return result;
end$$;

create function public.confirm_invoice_pdf(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_invoice uuid,p_document uuid,p_version uuid,p_sha256 text,p_correlation uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not public.billing_actor_authorized(p_actor,p_scope,p_org,true) then raise exception using errcode='42501',message='billing actor not authorized';end if;
 if not exists(select 1 from public.invoice_command_idempotency where organization_id=p_org and idempotency_key=p_key and command='generate_invoice_pdf' and result->>'documentId'=p_document::text) then raise exception using errcode='23514',message='PDF command mismatch';end if;
 update public.document_versions set status='available',sha256=p_sha256,uploaded_at=statement_timestamp() where id=p_version and document_id=p_document and organization_id=p_org and status='pending_upload';if not found then if not exists(select 1 from public.document_versions where id=p_version and status='available' and sha256=p_sha256) then raise exception using errcode='55000',message='PDF version cannot be confirmed';end if;end if;
 update public.documents set status='available',current_version_id=p_version,updated_at=statement_timestamp() where id=p_document and invoice_id=p_invoice and organization_id=p_org;
 result:=jsonb_build_object('ok',true,'documentId',p_document,'versionId',p_version,'status','available');update public.invoice_command_idempotency set result=result,completed_at=statement_timestamp() where organization_id=p_org and idempotency_key=p_key;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'billing.invoice_pdf_generated','invoice',p_invoice::text,jsonb_build_object('documentId',p_document,'versionId',p_version),p_correlation) on conflict do nothing;return result;
end$$;

alter table public.billing_fiscal_settings enable row level security;alter table public.billing_fiscal_settings force row level security;
alter table public.invoice_taxes enable row level security;alter table public.invoice_taxes force row level security;
alter table public.invoice_series enable row level security;alter table public.invoice_series force row level security;
alter table public.invoices enable row level security;alter table public.invoices force row level security;
alter table public.invoice_lines enable row level security;alter table public.invoice_lines force row level security;
alter table public.invoice_payments enable row level security;alter table public.invoice_payments force row level security;
alter table public.invoice_command_idempotency enable row level security;alter table public.invoice_command_idempotency force row level security;
create policy fiscal_settings_read on public.billing_fiscal_settings for select to authenticated using(public.can_access_master_data(organization_id,'billing'));
create policy invoice_taxes_read on public.invoice_taxes for select to authenticated using(public.can_access_master_data(organization_id,'billing'));
create policy invoice_series_read on public.invoice_series for select to authenticated using(public.can_access_master_data(organization_id,'billing'));
create policy invoices_read on public.invoices for select to authenticated using(public.can_access_master_data(organization_id,'billing'));
create policy invoice_lines_read on public.invoice_lines for select to authenticated using(public.can_access_master_data(organization_id,'billing'));
create policy invoice_payments_read on public.invoice_payments for select to authenticated using(public.can_access_master_data(organization_id,'billing'));
revoke all on table public.billing_fiscal_settings,public.invoice_taxes,public.invoice_series,public.invoices,public.invoice_lines,public.invoice_payments,public.invoice_command_idempotency from public,anon,authenticated;
grant select on table public.billing_fiscal_settings,public.invoice_taxes,public.invoice_series,public.invoices,public.invoice_lines,public.invoice_payments to authenticated;
grant all on table public.billing_fiscal_settings,public.invoice_taxes,public.invoice_series,public.invoices,public.invoice_lines,public.invoice_payments,public.invoice_command_idempotency to service_role;
revoke all on function public.next_invoice_number(uuid,uuid,date),public.issue_preinvoice_invoice(uuid,public.audit_actor_scope,uuid,uuid,uuid,date,uuid,date,text,uuid,uuid),public.record_invoice_payment(uuid,public.audit_actor_scope,uuid,uuid,numeric,date,public.invoice_payment_method,text,text,uuid,uuid),public.cancel_invoice(uuid,public.audit_actor_scope,uuid,uuid,text,uuid,uuid),public.configure_invoice_fiscal(uuid,public.audit_actor_scope,uuid,jsonb,jsonb,jsonb,uuid),public.create_corrective_invoice(uuid,public.audit_actor_scope,uuid,uuid,uuid,numeric,text,date,uuid,uuid),public.mark_invoice_overdue(uuid,public.audit_actor_scope,uuid,uuid,uuid),public.begin_invoice_pdf(uuid,public.audit_actor_scope,uuid,uuid,bigint,text,uuid,uuid),public.confirm_invoice_pdf(uuid,public.audit_actor_scope,uuid,uuid,uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.next_invoice_number(uuid,uuid,date),public.issue_preinvoice_invoice(uuid,public.audit_actor_scope,uuid,uuid,uuid,date,uuid,date,text,uuid,uuid),public.record_invoice_payment(uuid,public.audit_actor_scope,uuid,uuid,numeric,date,public.invoice_payment_method,text,text,uuid,uuid),public.cancel_invoice(uuid,public.audit_actor_scope,uuid,uuid,text,uuid,uuid),public.configure_invoice_fiscal(uuid,public.audit_actor_scope,uuid,jsonb,jsonb,jsonb,uuid),public.create_corrective_invoice(uuid,public.audit_actor_scope,uuid,uuid,uuid,numeric,text,date,uuid,uuid),public.mark_invoice_overdue(uuid,public.audit_actor_scope,uuid,uuid,uuid),public.begin_invoice_pdf(uuid,public.audit_actor_scope,uuid,uuid,bigint,text,uuid,uuid),public.confirm_invoice_pdf(uuid,public.audit_actor_scope,uuid,uuid,uuid,uuid,text,uuid,uuid) to service_role;
grant execute on function public.invoice_tenant_guard(),public.prevent_issued_invoice_mutation() to service_role;
comment on table public.invoices is 'Facturas fiscales básicas inmutables tras emisión; no implica certificación AEAT/VeriFactu/Facturae.';
