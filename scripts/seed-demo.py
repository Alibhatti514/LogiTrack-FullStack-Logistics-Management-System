#!/usr/bin/env python3
"""Resume-safe local demo importer. All business writes go through the authenticated API."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
TAG = '[DEMO LT1]'
CATALOG = {
 'Electronics': ['Dell Latitude Business Laptop','HP 24-inch Monitor','Logitech Wireless Keyboard','Zebra Barcode Scanner','Thermal Shipping Label Printer','Cisco Business Network Switch','APC UPS Battery Backup','Samsung Portable SSD 1TB','Logitech USB Conference Webcam','TP-Link Warehouse Access Point'],
 'Warehouse Equipment': ['Hydraulic Pallet Jack','Heavy Duty Platform Trolley','Steel Warehouse Shelving','Electric Pallet Stacker','Warehouse Step Ladder','Digital Platform Weighing Scale','Pallet Stretch Wrap Dispenser','Dock Safety Wheel Chocks'],
 'Packaging Materials': ['Industrial Packing Tape','Heavy Duty Shipping Cartons','Protective Bubble Wrap','Corrugated Mailer Boxes','Pallet Stretch Film Rolls','Polypropylene Strapping Coils','Kraft Packing Paper Rolls','Thermal Shipping Label Rolls'],
 'Automotive Supplies': ['Commercial Vehicle Battery','Diesel Engine Oil 5L','Automotive Air Filter','Commercial Vehicle Brake Pads','Fleet Coolant Concentrate','Heavy Duty Wiper Blades','Truck Fuel Filter','Reflective Vehicle Safety Kit'],
 'Office Supplies': ['A4 Printer Paper Ream','Blue Ballpoint Pen Pack','Lever Arch Filing Folder','Black Laser Toner Cartridge','Desktop Stapler','Warehouse Clipboard','Office Desk Organizer','Permanent Marker Pack'],
 'Industrial Equipment': ['Industrial Safety Gloves','Protective Safety Helmet','High Visibility Safety Vest','Cordless Industrial Drill','Heavy Duty Extension Cable','Industrial LED Work Light','Safety Goggles','Dry Powder Fire Extinguisher'],
}
CUSTOMERS = ['Pak Logistics Solutions','Metro Distribution Services','Punjab Retail Network','Karachi Industrial Traders','National Supply Partners','Prime Commerce Pakistan','BlueRoute Distribution','Atlas Manufacturing','CityMart Wholesale','Rapid Freight Solutions']

class SeedError(Exception):
    pass

def load_environment():
    # Environment wins. Parse simple dotenv assignments as data; never execute shell content.
    for path in [ROOT / '.env', ROOT / 'frontend' / '.env.local']:
        if path.exists():
            for line in path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, value = line.removeprefix('export ').split('=', 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

def plan():
    products = []
    for category, names in CATALOG.items():
        for name in names:
            i = len(products)
            final = 200 + (i * 17) % 301 if i < 30 else 60 + (i * 7) % 70 if i < 40 else i - 39 if i < 47 else 0
            location_index = i % 40
            location = f"{['LHR-A','KHI-B','ISB-C','MUX-D'][location_index // 10]}{location_index % 10 + 1:02}"
            products.append(dict(name=f'{TAG} {name}', category=category, location=location, finalQuantity=final, quantity=final))
    orders = []
    for i in range(25):
        lines = [{'index': (i * 3 + n * 7) % 40, 'quantity': 1 + (i + n * 2) % 8} for n in range(1 + i % 4)]
        for line in lines:
            products[line['index']]['quantity'] += line['quantity']
        orders.append({'customerName': f'{TAG} {i+1:03} · {CUSTOMERS[i % len(CUSTOMERS)]}', 'lines': lines})
    return products, orders

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None

class Api:
    def __init__(self, base):
        self.base, self.token = base, None
    def request(self, method, path, body=None):
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        request = urllib.request.Request(self.base + '/api/' + path, method=method, headers=headers,
            data=None if body is None else json.dumps(body).encode())
        try:
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            # Never echo a response body: development exception output may contain sensitive information.
            raise SeedError(f'{method} {path}: HTTP {error.code}. Check Manager permissions, validation and API availability.') from None
        except (OSError, ValueError) as error:
            raise SeedError(f'{method} {path}: network or response failure. No automatic POST retry; rerun to reconcile live records.') from None

def save(path, manifest):
    fd, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as file:
            json.dump(manifest, file, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)

def unique(records, field):
    found = {}
    for record in records:
        key = record[field]
        if key in found and key.startswith(TAG):
            raise SeedError('Duplicate demo identifiers detected. Import stopped for manual review; no records deleted.')
        found[key] = record
    return found

def run(args):
    load_environment()
    base = (args.url or os.environ.get('LOGITRACK_URL') or os.environ.get('API_URL') or os.environ.get('NEXT_PUBLIC_API_URL') or 'http://127.0.0.1:5187').rstrip('/')
    parsed = urllib.parse.urlparse(base)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise SeedError('API URL must be an HTTP(S) origin without credentials, query or fragment.')
    if parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1', '::1'):
        raise SeedError('Remote seeding requires HTTPS to protect Manager credentials.')
    state_dir = ROOT / '.local'
    state_dir.mkdir(mode=0o700, exist_ok=True)
    manifest_path = state_dir / 'demo-seed-v1.json'
    with (state_dir / 'demo-seed-v1.lock').open('a') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise SeedError('Another local seed process is running.') from None
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'version': 1, 'api': base, 'inventory': {}, 'orders': {}}
        if manifest.get('api') != base or manifest.get('version') != 1:
            raise SeedError('Manifest belongs to a different API or seed version. Do not reuse it for another database.')
        email = os.environ.get('Bootstrap__ManagerEmail')
        password = os.environ.get('Bootstrap__ManagerPassword')
        if not email or not password: raise SeedError('Set Bootstrap__ManagerEmail and Bootstrap__ManagerPassword in the environment or existing root .env.')
        api = Api(base)
        _, login = api.request('POST', 'auth/login', {'email': email, 'password': password})
        api.token = login['accessToken']
        claims = json.loads(__import__('base64').urlsafe_b64decode(api.token.split('.')[1] + '==='))
        role = claims.get('http://schemas.microsoft.com/ws/2008/06/identity/claims/role', [])
        if 'Manager' not in ([role] if isinstance(role, str) else role): raise SeedError('This account is not a Manager. Nothing imported.')
        products, order_plan = plan()
        _, inventory = api.request('GET', 'inventory')
        _, orders = api.request('GET', 'orders')
        by_name = unique(inventory, 'name')
        by_customer = unique(orders, 'customerName')
        # Preflight completed records before making any new writes. Never recreate deleted demo records automatically.
        for kind, lookup, id_key in [('inventory', by_name, 'itemId'), ('orders', by_customer, 'orderId')]:
            for name, saved in manifest[kind].items():
                if saved.get('id') and (name not in lookup or lookup[name][id_key] != saved['id']):
                    raise SeedError('A previously imported demo record is missing or replaced. Import stopped; restore/review the manifest and database together.')
        created_inventory = created_orders = 0
        ids = []
        for product in products:
            name = product['name']
            record = by_name.get(name)
            if record and record['location'] != product['location']:
                raise SeedError('Demo product location differs from catalog. Import stopped without overwriting it.')
            if not record:
                if manifest['inventory'].get(name, {}).get('pending'): raise SeedError('An inventory POST has an uncertain outcome. Wait for API requests to finish and inspect the pending manifest entry before retrying; no duplicate POST was sent.')
                if args.verify_only: raise SeedError('Demo inventory is incomplete.')
                manifest['inventory'][name] = {'pending': True}
                save(manifest_path, manifest)
                status, record = api.request('POST', 'inventory', {key: product[key] for key in ['name', 'quantity', 'location']})
                if status != 201 or not isinstance(record.get('itemId'), int): raise SeedError('Unexpected inventory creation response; rerun to reconcile.')
                created_inventory += 1
            ids.append(record['itemId'])
            manifest['inventory'][name] = {'id': record['itemId'], 'category': product['category'], 'initialQuantity': product['quantity'], 'expectedFinalQuantity': product['finalQuantity']}
            save(manifest_path, manifest)
        for order in order_plan:
            name = order['customerName']
            items = [{'inventoryItemId': ids[line['index']], 'quantity': line['quantity']} for line in order['lines']]
            record = by_customer.get(name)
            if not record:
                if manifest['orders'].get(name, {}).get('pending'): raise SeedError('An order POST has an uncertain outcome. Wait for API requests to finish and inspect the pending manifest entry before retrying; no duplicate POST was sent.')
                if args.verify_only: raise SeedError('Demo orders are incomplete.')
                manifest['orders'][name] = {'pending': True}
                save(manifest_path, manifest)
                status, record = api.request('POST', 'orders', {'customerName': name, 'items': items})
                if status != 201 or not isinstance(record.get('orderId'), int): raise SeedError('Unexpected order creation response; rerun to reconcile.')
                created_orders += 1
            _, detail = api.request('GET', f"orders/{record['orderId']}")
            actual = sorted((line['inventoryItemId'], line['quantity']) for line in detail['items'])
            expected = sorted((line['inventoryItemId'], line['quantity']) for line in items)
            if actual != expected: raise SeedError('Demo order lines differ from the seed plan. No existing order was modified.')
            manifest['orders'][name] = {'id': record['orderId']}
            save(manifest_path, manifest)
        _, latest = api.request('GET', 'inventory')
        current = {item['itemId']: item for item in latest}
        buckets = {'healthy': 0, 'medium': 0, 'low': 0, 'out': 0}
        for item_id in ids:
            qty = current[item_id]['quantity']
            buckets['out' if qty == 0 else 'low' if qty <= 10 else 'medium' if qty < 150 else 'healthy'] += 1
        drift = sum(current[item_id]['quantity'] != product['finalQuantity'] for item_id, product in zip(ids, products))
        print(f'Created: {created_inventory} inventory products, {created_orders} orders.')
        print(f'Verified: {len(ids)} demo products, {len(order_plan)} demo orders; {sum(current[i]["quantity"] for i in ids):,} available units.')
        print('Stock distribution: ' + ', '.join(f'{key}={value}' for key, value in buckets.items()))
        print(f'Low-stock dashboard threshold <=10: {buckets["low"] + buckets["out"]} products (includes out of stock).')
        print(f'Live stock differs from original post-seed plan for {drift} products (later business activity is preserved).')
        print('Categories: ' + ', '.join(f'{name}={len(items)}' for name, items in CATALOG.items()))
        print('Orders use actual creation timestamps; no historical dates or analytics are fabricated.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', help='API origin; defaults to existing API environment configuration')
    parser.add_argument('--verify-only', action='store_true', help='Validate live demo records without creating missing records')
    try: run(parser.parse_args())
    except (SeedError, OSError, ValueError, KeyError, TypeError) as error:
        message = str(error) if isinstance(error, SeedError) else 'Invalid configuration, manifest or API response. Inspect locally; secrets were not printed.'
        print('Seed stopped: ' + message, file=sys.stderr)
        sys.exit(1)
