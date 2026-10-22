#!/usr/bin/env python3
"""HTTP integration smoke tests. Run while API is running. Python 3 standard library only."""
import json, os, urllib.request, urllib.error, uuid, sys
BASE = os.environ.get('LOGITRACK_URL','http://127.0.0.1:5187')
def req(method,path,data=None,token=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    body=json.dumps(data).encode() if data is not None else None
    request=urllib.request.Request(BASE+path,data=body,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=15) as r:
            raw=r.read(); return r.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw=e.read();
        try: payload=json.loads(raw)
        except Exception: payload=raw.decode(errors='replace')
        return e.code,payload
def check(actual,expected,label):
    if actual!=expected: raise AssertionError(f'{label}: expected {expected}, got {actual}')
    print(f'PASS {label}: HTTP {actual}')
check(req('GET','/health')[0],200,'health')
check(req('GET','/api/inventory')[0],401,'anonymous blocked')
email='test-'+uuid.uuid4().hex[:10]+'@example.com'
password='TestPassword!23456'
check(req('POST','/api/auth/register',{'email':email,'password':password})[0],201,'register')
code,login=req('POST','/api/auth/login',{'email':email,'password':password})
check(code,200,'login')
user_token=login['accessToken']
check(req('GET','/api/inventory',token=user_token)[0],200,'authorized read')
check(req('POST','/api/inventory',{'name':'Denied','quantity':1,'location':'A'},user_token)[0],403,'non-manager blocked')
manager_email=os.environ.get('Bootstrap__ManagerEmail')
manager_password=os.environ.get('Bootstrap__ManagerPassword')
if not manager_email or not manager_password:
    print('SKIP manager write tests: export Bootstrap__ManagerEmail and Bootstrap__ManagerPassword from .env');sys.exit(0)
code,manager=req('POST','/api/auth/login',{'email':manager_email,'password':manager_password})
check(code,200,'manager login')
token=manager['accessToken']
check(req('POST','/api/inventory',{'name':'Bad','quantity':-1,'location':'A'},token)[0],400,'input validation')
code,item=req('POST','/api/inventory',{'name':'Pallet Jack','quantity':12,'location':'Warehouse A'},token)
check(code,201,'create inventory')
id=item['itemId']
code,listing=req('GET','/api/inventory',token=user_token)
check(code,200,'inventory list')
assert any(x['itemId']==id for x in listing),'cache not invalidated on inventory creation'
code,order=req('POST','/api/orders',{'customerName':'Samir','items':[{'inventoryItemId':id,'quantity':2}]},token)
check(code,201,'create order')
oid=order['orderId']
code,details=req('GET',f'/api/orders/{oid}',token=user_token)
check(code,200,'order details')
assert details['items'][0]['quantity']==2
code,listing=req('GET','/api/inventory',token=user_token)
assert next(x for x in listing if x['itemId']==id)['quantity']==10,'stock decrement or cache invalidation failed'
check(req('DELETE',f'/api/inventory/{id}',token=token)[0],409,'referenced inventory protected')
check(req('DELETE',f'/api/orders/{oid}',token=token)[0],204,'delete order')
code,listing=req('GET','/api/inventory',token=user_token)
assert next(x for x in listing if x['itemId']==id)['quantity']==12,'stock restoration failed'
check(req('DELETE',f'/api/inventory/{id}',token=token)[0],204,'delete inventory')
check(req('GET',f'/api/orders/{oid}',token=user_token)[0],404,'deleted order missing')
print('ALL API TESTS PASSED')
