#!/usr/bin/env python3
"""Stock invariants against the running API. Removes only records created by this run."""
import concurrent.futures, json, os, urllib.request, urllib.error, uuid
BASE=os.environ.get('LOGITRACK_URL','http://127.0.0.1:5187')
def req(method,path,data=None,token=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    r=urllib.request.Request(BASE+path, data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    try:
        with urllib.request.urlopen(r,timeout=30) as response:
            raw=response.read();return response.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        return error.code,None
status,body=req('POST','/api/auth/login',{'email':os.environ['Bootstrap__ManagerEmail'],'password':os.environ['Bootstrap__ManagerPassword']})
assert status==200
token=body['accessToken'];ids=[];orders=[]
def stock(item):
    return next(x['quantity'] for x in req('GET','/api/inventory',token=token)[1] if x['itemId']==item)
try:
    for n in range(2):
        status,item=req('POST','/api/inventory',{'name':'StockTest-'+uuid.uuid4().hex,'quantity':10,'location':'Test temporary'},token)
        assert status==201;ids.append(item['itemId'])
    def order(lines):
        status,result=req('POST','/api/orders',{'customerName':'Stock invariant test','items':lines},token)
        if status==201:orders.append(result['orderId'])
        return status
    assert order([{'inventoryItemId':ids[0],'quantity':2},{'inventoryItemId':ids[0],'quantity':3}])==201
    assert stock(ids[0])==5
    print('PASS duplicate order lines aggregated')
    assert order([{'inventoryItemId':ids[1],'quantity':2},{'inventoryItemId':ids[0],'quantity':6}])==409
    assert stock(ids[1])==10 and stock(ids[0])==5
    print('PASS multi-line rejection rolls back all stock')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(lambda _:order([{'inventoryItemId':ids[0],'quantity':2}]),range(6)))
    assert results.count(201)==2 and results.count(409)==4,results
    assert stock(ids[0])==1
    print('PASS concurrent orders: 2 accepted, 4 rejected, no negative stock')
    oid=orders.pop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        deleted=list(pool.map(lambda _:req('DELETE',f'/api/orders/{oid}',token=token)[0],range(4)))
    assert deleted.count(204)==1 and deleted.count(404)==3,deleted
    print('PASS concurrent deletion restores stock only once')
finally:
    for oid in orders:assert req('DELETE',f'/api/orders/{oid}',token=token)[0]==204
    for iid in ids:
        assert stock(iid)==10
        assert req('DELETE',f'/api/inventory/{iid}',token=token)[0]==204
print('PASS exact stock restoration and temporary record cleanup')
