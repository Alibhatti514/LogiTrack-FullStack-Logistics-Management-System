#!/usr/bin/env python3
"""Isolated seed resilience tests. No network calls or real database mutations."""
import base64
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('seed', Path(__file__).with_name('seed-demo.py'))
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)

class FakeApi:
    inventory = []
    orders = []
    fail = None
    def __init__(self, base): self.token = None
    def request(self, method, path, body=None):
        if path == 'auth/login':
            claims = {'http://schemas.microsoft.com/ws/2008/06/identity/claims/role':'Manager'}
            return 200, {'accessToken':'header.'+base64.urlsafe_b64encode(json.dumps(claims).encode()).decode()+'.signature'}
        if method == 'GET' and path == 'inventory': return 200, copy.deepcopy(self.inventory)
        if method == 'GET' and path == 'orders': return 200, copy.deepcopy(self.orders)
        if method == 'GET': return 200, copy.deepcopy(next(o for o in self.orders if o['orderId'] == int(path.split('/')[1])))
        if self.fail == 'before':
            FakeApi.fail = None
            raise seed.SeedError('simulated uncertain response before commit')
        if path == 'inventory':
            record = dict(body, itemId=len(self.inventory)+1)
            self.inventory.append(record)
        else:
            for line in body['items']:
                item = next(i for i in self.inventory if i['itemId']==line['inventoryItemId'])
                if item['quantity'] < line['quantity']: raise AssertionError('overselling')
                item['quantity'] -= line['quantity']
            record = dict(body, orderId=len(self.orders)+1)
            self.orders.append(record)
        if self.fail == path:
            FakeApi.fail = None
            raise seed.SeedError('simulated lost response after commit')
        return 201, copy.deepcopy(record)

class SeedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        FakeApi.inventory, FakeApi.orders, FakeApi.fail = [], [], None
        patches = [patch.object(seed,'ROOT',Path(self.temp.name)),patch.object(seed,'Api',FakeApi),patch.dict(os.environ,{'Bootstrap__ManagerEmail':'fixture@example.invalid','Bootstrap__ManagerPassword':'fixture-not-used-for-auth'},clear=True)]
        for p in patches: p.start();self.addCleanup(p.stop)
    def run_seed(self):
        with contextlib.redirect_stdout(io.StringIO()): seed.run(SimpleNamespace(url='http://127.0.0.1:5187',verify_only=False))
    def test_catalog_stock_and_idempotence(self):
        self.run_seed();before=copy.deepcopy((FakeApi.inventory,FakeApi.orders));self.run_seed()
        self.assertEqual(before,(FakeApi.inventory,FakeApi.orders))
        self.assertEqual((len(FakeApi.inventory),len(FakeApi.orders)),(50,25))
        self.assertEqual([i['quantity'] for i in FakeApi.inventory],[i['finalQuantity'] for i in seed.plan()[0]])
        self.assertEqual(len(set(i['location'] for i in FakeApi.inventory)),40)
        self.assertEqual(len(set(i['name'] for i in FakeApi.inventory)),50)
        quantities=[item['quantity'] for item in FakeApi.inventory]
        self.assertEqual([sum(q>=150 for q in quantities),sum(40<=q<150 for q in quantities),sum(1<=q<=10 for q in quantities),sum(q==0 for q in quantities)],[30,10,7,3])
        self.assertTrue(all(1<=len(order['items'])<=4 for order in FakeApi.orders))
    def test_resume_lost_inventory_response(self):
        FakeApi.fail='inventory'
        with self.assertRaises(seed.SeedError):self.run_seed()
        self.run_seed();self.assertEqual(len(FakeApi.inventory),50)
    def test_resume_lost_order_response_without_double_deduction(self):
        FakeApi.fail='orders'
        with self.assertRaises(seed.SeedError):self.run_seed()
        self.run_seed();self.assertEqual(len(FakeApi.orders),25)
        self.assertEqual([i['quantity'] for i in FakeApi.inventory],[i['finalQuantity'] for i in seed.plan()[0]])
    def test_uncertain_missing_record_stops_without_retry(self):
        FakeApi.fail='before'
        with self.assertRaises(seed.SeedError):self.run_seed()
        with self.assertRaises(seed.SeedError):self.run_seed()
        self.assertEqual(FakeApi.inventory,[])
    def test_deleted_demo_record_is_not_recreated(self):
        self.run_seed();FakeApi.inventory.pop()
        with self.assertRaises(seed.SeedError):self.run_seed()
        self.assertEqual(len(FakeApi.inventory),49)
    def test_duplicate_marker_stops(self):
        self.run_seed();FakeApi.orders.append(copy.deepcopy(FakeApi.orders[0]))
        with self.assertRaises(seed.SeedError):self.run_seed()

if __name__ == '__main__': unittest.main()
