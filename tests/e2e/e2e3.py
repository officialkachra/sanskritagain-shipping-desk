from playwright.sync_api import sync_playwright
B = "http://localhost:3100"
def login(pg, role):
    pg.goto(B + "/login"); pg.check(f"input[value={role}]"); pg.fill("input[name=password]", "localtestpw"); pg.click("button.btn-primary"); pg.wait_for_url(B + "/")
with sync_playwright() as p:
    br = p.chromium.launch()
    a = br.new_context(); a.set_default_timeout(10000); pa = a.new_page(); login(pa, "ADMIN")
    pa.goto(B + "/orders/DEMO-1010?tab=packing"); pa.select_option("select[name=box]", "23x10x7_cm"); pa.fill("input[name=weight]", "560"); pa.check("input[name=stock]"); pa.click("button:has-text('Save packing')"); pa.wait_for_selector(".msg")
    k = br.new_context(); k.set_default_timeout(10000); pk = k.new_page(); login(pk, "PACKER")
    pk.goto(B + "/orders/DEMO-1010?tab=booking"); t = pk.inner_text(".page")
    print("packer sees review:", "Exact shipment to be booked" in t, "| approve button:", pk.locator("button:has-text('Approve this shipment')").count(), "| admin-only note:", "Only an admin can approve" in t)
    n = br.new_context(); r = n.request.get(B + "/api/export", max_redirects=0)
    print("anon export status:", r.status, "| body has PII header:", "customer_name" in r.text())
    print("anon /ndr:", n.request.get(B + "/ndr", max_redirects=0).status)
    br.close()
