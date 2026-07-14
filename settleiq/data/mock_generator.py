"""SettleIQ mock data generator.

Builds:
  - data/settleiq.db SQLite database with:
      settlement_events, pipeline_logs, merchant_registry,
      bank_downtime_events, chargebacks
  - data/merchant_registry.json (also mirrored into SQLite)

Idempotent: drops and recreates tables on each run.
Run from repo root:  python data/mock_generator.py
"""

from __future__ import annotations

import json
import os
import random
import sqlite3
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "settleiq.db")
REGISTRY_JSON = os.path.join(HERE, "merchant_registry.json")

# Deterministic
random.seed(42)

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------
NAMED_MERCHANTS = [
    ("Amazon Seller Central", "marketplace"),
    ("Shopify Merchant", "marketplace"),
    ("Etsy", "marketplace"),
    ("eBay", "marketplace"),
    ("Wayfair", "retail"),
    ("DoorDash", "food_delivery"),
    ("Uber Eats", "food_delivery"),
    ("Grubhub", "food_delivery"),
    ("Instacart", "food_delivery"),
    ("Postmates", "food_delivery"),
    ("Uber", "ride_share"),
    ("Lyft", "ride_share"),
    ("Bird Scooters", "mobility"),
    ("Lime", "mobility"),
    ("Netflix", "subscription"),
    ("Spotify", "subscription"),
    ("Zoom", "saas"),
    ("Dropbox", "saas"),
    ("Adobe", "saas"),
    ("Airbnb", "travel"),
    ("Expedia", "travel"),
    ("Delta Air Lines", "airline"),
    ("United Airlines", "airline"),
    ("Booking.com", "travel"),
    ("McDonald's", "qsr"),
    ("Starbucks", "qsr"),
    ("Chipotle", "qsr"),
    ("CVS", "pharmacy"),
    ("Walgreens", "pharmacy"),
    ("Costco", "retail"),
    ("Target", "retail"),
    ("Cash App", "fintech"),
    ("Robinhood", "fintech"),
    ("Coinbase", "crypto"),
    ("Chime", "fintech"),
    ("Brex", "fintech"),
    ("Teladoc", "healthtech"),
    ("GoodRx", "healthtech"),
    ("Zocdoc", "healthtech"),
    ("Hims & Hers", "healthtech"),
    ("Salesforce", "saas"),
    ("HubSpot", "saas"),
    ("Twilio", "saas"),
    ("Stripe Connect - Acme Tools", "platform"),
    ("Stripe Connect - Pioneer Goods", "platform"),
]

# Fillers to reach 100+ merchants
FILLER_PREFIXES = [
    "Sunrise", "Granite", "Liberty", "Cascade", "Harbor", "Summit",
    "Atlas", "Beacon", "Cardinal", "Delta", "Evergreen", "Falcon",
    "Glacier", "Heritage", "Ironclad", "Juniper", "Keystone", "Lighthouse",
    "Monarch", "Northstar", "Oakridge", "Pinnacle", "Quartz", "Redwood",
    "Silverline", "Tidewater", "Union", "Vanguard", "Westport", "Yellowstone",
]
FILLER_SUFFIXES = [
    "Holdings", "Outfitters", "Markets", "Trading Co", "Logistics",
    "Foods", "Studios", "Health", "Mobility", "Capital", "Brands",
    "Services", "Networks", "Group", "Partners",
]
FILLER_VERTICALS = [
    "retail", "marketplace", "saas", "fintech", "healthtech",
    "travel", "food_delivery", "subscription", "platform", "qsr",
]

ACQUIRING_BANKS = [
    "JPMorgan Chase",
    "Wells Fargo",
    "Bank of America",
    "Citi",
    "U.S. Bank",
    "Fifth Third",
]

SETTLEMENT_TYPES = ["gross", "net"]
SETTLEMENT_SCHEDULES = ["T+0", "T+1", "T+2", "twice_daily", "real_time"]
SETTLEMENT_FREQUENCIES = ["daily", "weekly", "monthly", "on_demand"]
RISK_TIERS = ["low", "medium", "high"]
STATUSES_MERCHANT = ["active", "active", "active", "active", "frozen", "on_hold"]
PAYMENT_RAILS = ["ACH", "Fedwire", "RTP", "FedNow", "Card_Network"]

# return codes (NACHA-ish)
RETURN_CODES = [
    ("R01", "Insufficient funds"),
    ("R03", "No account / unable to locate account"),
    ("R04", "Invalid account number"),
    ("R07", "Authorization revoked by customer"),
    ("R10", "Customer advises unauthorized"),
    ("BANK_TIMEOUT", "Acquiring bank timeout"),
    ("RAIL_REJECT", "Payment rail rejected"),
]

SETTLE_STATUSES = ["settled", "pending", "failed", "returned", "provisional"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fmt_ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def gen_phone(idx: int) -> str:
    # deterministic US-format phone
    area = 200 + (idx * 13) % 700
    mid = 200 + (idx * 7) % 700
    last = (idx * 9301 + 49297) % 10000
    return f"+1-{area:03d}-{mid:03d}-{last:04d}"


def gen_routing() -> str:
    return f"{random.randint(10000000, 99999999)}{random.randint(0, 9)}"


def gen_last4() -> str:
    return f"{random.randint(0, 9999):04d}"


# ---------------------------------------------------------------------------
# Build merchant registry
# ---------------------------------------------------------------------------

def build_merchants() -> list[dict]:
    merchants: list[dict] = []
    used_phones: set[str] = set()
    target = 110
    pool: list[tuple[str, str]] = list(NAMED_MERCHANTS)
    i = 0
    while len(pool) < target:
        name = f"{FILLER_PREFIXES[i % len(FILLER_PREFIXES)]} {FILLER_SUFFIXES[(i // 3) % len(FILLER_SUFFIXES)]} {i}"
        vertical = FILLER_VERTICALS[i % len(FILLER_VERTICALS)]
        pool.append((name, vertical))
        i += 1

    # Shared phone case for UC3 disambiguation
    shared_phone = "+1-415-555-0199"

    for idx, (name, vertical) in enumerate(pool, start=1):
        mid = f"MID{1000 + idx:05d}"
        schedule = random.choice(SETTLEMENT_SCHEDULES)
        # Most merchants active; some frozen / on_hold to support UC10
        status = STATUSES_MERCHANT[idx % len(STATUSES_MERCHANT)]
        if idx == 1:  # Force one named merchant frozen for demos
            pass
        risk = random.choices(RISK_TIERS, weights=[6, 3, 1])[0]
        reserve = round(random.uniform(2_000, 800_000), 2)
        # Inject one negative reserve to demonstrate sanity validator
        if name == "Bird Scooters":
            reserve = -12_500.00
        if name == "DoorDash":
            status = "frozen"
        if name == "GoodRx":
            status = "on_hold"

        # phone assignment: two named merchants share a phone for UC3
        if name in ("Shopify Merchant", "Etsy"):
            phone = shared_phone
        else:
            phone = gen_phone(idx)
            while phone in used_phones:
                phone = gen_phone(idx + len(merchants) + 1)
            used_phones.add(phone)

        merchants.append({
            "mid": mid,
            "business_name": name,
            "vertical": vertical,
            "acquiring_bank": random.choice(ACQUIRING_BANKS),
            "settlement_type": random.choice(SETTLEMENT_TYPES),
            "settlement_schedule": schedule,
            "settlement_frequency": random.choice(SETTLEMENT_FREQUENCIES),
            "reserve_account_balance_usd": reserve,
            "linked_routing_number": gen_routing(),
            "linked_account_number_last4": gen_last4(),
            "status": status,
            "risk_tier": risk,
            "phone_number": phone,
        })
    return merchants


# ---------------------------------------------------------------------------
# Build settlement events
# ---------------------------------------------------------------------------

def build_settlement_events(merchants: list[dict], rows: int = 11_000) -> list[tuple]:
    now = datetime.now(timezone.utc)
    events: list[tuple] = []
    payout_pool: list[str] = []

    # Pre-allocate payout IDs - group settlement events into payouts
    for n in range(2_500):
        payout_pool.append(f"PO_{100000 + n}")

    # Guarantee certain merchants always have demo-friendly failures
    forced_failures = {
        next((m["mid"] for m in merchants if m["business_name"] == "Lyft"), None): 25,
    }
    forced_failures = {k: v for k, v in forced_failures.items() if k}

    for i in range(rows):
        m = random.choice(merchants)
        # bias: 80% settled, 6% pending, 6% failed, 4% returned, 4% provisional
        status = random.choices(
            SETTLE_STATUSES, weights=[80, 6, 6, 4, 4]
        )[0]
        # Force a chunk of Lyft to be 'failed' with R01 in the last 7 days
        forced = False
        if m["mid"] in forced_failures and forced_failures[m["mid"]] > 0:
            forced_failures[m["mid"]] -= 1
            status = "failed"
            forced = True
        if forced:
            initiated = now - timedelta(
                days=random.randint(0, 6),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )
        else:
            initiated = now - timedelta(
                days=random.randint(0, 45),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )
        # settlement latency
        if status == "settled":
            latency_s = random.randint(30, 18_000)  # up to ~5 hrs
        elif status == "pending":
            latency_s = random.randint(60, 7200)
        elif status == "provisional":
            latency_s = random.randint(45, 600)
        else:
            latency_s = random.randint(15, 9000)
        settled_at = initiated + timedelta(seconds=latency_s) if status in ("settled", "provisional") else None

        amount = round(random.uniform(20, 50_000), 2)
        # inject one large anomaly amount to exercise validator
        if i == 7:
            amount = 12_500_000.00
        fee = round(amount * random.uniform(0.005, 0.029), 2)
        net = round(amount - fee, 2)
        rail = random.choices(PAYMENT_RAILS, weights=[55, 10, 20, 5, 10])[0]
        attempt = random.choices([1, 2, 3], weights=[88, 9, 3])[0]
        if status in ("failed", "returned"):
            if forced:
                code, reason = ("R01", "Insufficient funds")
            else:
                code, reason = random.choice(RETURN_CODES)
        else:
            code, reason = (None, None)
        is_prov = 1 if status == "provisional" else 0
        credit_conf_at = (settled_at + timedelta(hours=random.randint(1, 24))) if is_prov else None
        bank_ref = f"BR{random.randint(1_000_000, 9_999_999)}"
        routing = m["linked_routing_number"]
        trace = f"TR{random.randint(10**11, 10**12 - 1)}"
        payout_id = random.choice(payout_pool)

        events.append((
            f"SE_{1000000 + i}",
            m["mid"],
            payout_id,
            fmt_ts(initiated),
            fmt_ts(settled_at) if settled_at else None,
            amount,
            net,
            fee,
            rail,
            status,
            attempt,
            code,
            reason,
            is_prov,
            fmt_ts(credit_conf_at) if credit_conf_at else None,
            bank_ref,
            routing,
            trace,
        ))
    return events


# ---------------------------------------------------------------------------
# Build downtime events
# ---------------------------------------------------------------------------

def build_downtime() -> list[tuple]:
    now = datetime.now(timezone.utc)
    windows = [
        ("ACH", "JPMorgan Chase", now - timedelta(days=2, hours=4), 90, "ACH batch processor delayed due to upstream FedACH window slip."),
        ("Fedwire", "Federal Reserve", now - timedelta(days=5, hours=2), 35, "Fedwire intermittent latency during EOD cycle."),
        ("RTP", "The Clearing House", now - timedelta(days=8, hours=1), 18, "RTP message queue backpressure - resolved by TCH operator."),
        ("ACH", "Wells Fargo", now - timedelta(days=1, hours=6), 45, "Acquiring bank ACH origination service degradation."),
        ("FedNow", "Federal Reserve", now - timedelta(days=10), 22, "FedNow scheduled maintenance window."),
        ("Card_Network", "Visa", now - timedelta(days=3, hours=9), 12, "Visa network blip - regional."),
    ]
    rows = []
    for i, (rail, provider, start, dur_min, note) in enumerate(windows):
        end = start + timedelta(minutes=dur_min)
        rows.append((
            f"DT_{1000+i}", rail, provider,
            fmt_ts(start), fmt_ts(end), dur_min, note,
        ))
    return rows


# ---------------------------------------------------------------------------
# Build chargebacks
# ---------------------------------------------------------------------------

def build_chargebacks(merchants: list[dict]) -> list[tuple]:
    rows = []
    reason_codes = [
        ("4853", "Cardholder dispute - service not provided"),
        ("4855", "Goods or services not provided"),
        ("10.4", "Fraudulent transaction - card not present"),
        ("13.1", "Merchandise / services not received"),
        ("12.5", "Incorrect amount"),
    ]
    statuses = ["open", "won", "lost", "pending_evidence"]
    # Ensure Coinbase has a chargeback (UC11 test)
    targets = []
    coinbase = next((m for m in merchants if m["business_name"] == "Coinbase"), None)
    if coinbase:
        targets.append(coinbase)
    # add others
    targets.extend(random.sample(merchants, 30))
    now = datetime.now(timezone.utc)
    for i, m in enumerate(targets):
        code, label = random.choice(reason_codes)
        rows.append((
            f"CB_{2000+i}",
            m["mid"],
            f"TXN_{random.randint(10**7, 10**8)}",
            round(random.uniform(40, 5_000), 2),
            code,
            label,
            random.choice(statuses),
            fmt_ts(now - timedelta(days=random.randint(0, 45))),
        ))
    return rows


# ---------------------------------------------------------------------------
# DB creation
# ---------------------------------------------------------------------------

SCHEMA = {
    "merchant_registry": """
        CREATE TABLE merchant_registry (
            mid TEXT PRIMARY KEY,
            business_name TEXT NOT NULL,
            vertical TEXT,
            acquiring_bank TEXT,
            settlement_type TEXT,
            settlement_schedule TEXT,
            settlement_frequency TEXT,
            reserve_account_balance_usd REAL,
            linked_routing_number TEXT,
            linked_account_number_last4 TEXT,
            status TEXT,
            risk_tier TEXT,
            phone_number TEXT
        )
    """,
    "settlement_events": """
        CREATE TABLE settlement_events (
            settlement_id TEXT PRIMARY KEY,
            merchant_id TEXT,
            payout_id TEXT,
            initiated_at TEXT,
            settled_at TEXT,
            amount_usd REAL,
            net_amount_usd REAL,
            fee_deducted_usd REAL,
            payment_rail TEXT,
            status TEXT,
            attempt_number INTEGER,
            return_code TEXT,
            failure_reason_text TEXT,
            is_provisional_credit INTEGER,
            credit_confirmed_at TEXT,
            bank_reference_id TEXT,
            aba_routing_number TEXT,
            settlement_trace_number TEXT
        )
    """,
    "pipeline_logs": """
        CREATE TABLE pipeline_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            user_email TEXT,
            user_role TEXT,
            query TEXT,
            classifier_result TEXT,
            router_result TEXT,
            analyst_result TEXT,
            validator_result TEXT,
            final_response TEXT,
            latency_ms INTEGER,
            token_cost_usd REAL,
            sanity_status TEXT,
            response_hash TEXT
        )
    """,
    "bank_downtime_events": """
        CREATE TABLE bank_downtime_events (
            event_id TEXT PRIMARY KEY,
            rail TEXT,
            provider TEXT,
            start_ts TEXT,
            end_ts TEXT,
            duration_min INTEGER,
            note TEXT
        )
    """,
    "chargebacks": """
        CREATE TABLE chargebacks (
            chargeback_id TEXT PRIMARY KEY,
            merchant_id TEXT,
            transaction_id TEXT,
            amount_usd REAL,
            reason_code TEXT,
            reason_label TEXT,
            status TEXT,
            opened_at TEXT
        )
    """,
}


def main() -> None:
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    for ddl in SCHEMA.values():
        cur.execute(ddl)

    merchants = build_merchants()
    cur.executemany(
        """INSERT INTO merchant_registry VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(m["mid"], m["business_name"], m["vertical"], m["acquiring_bank"],
          m["settlement_type"], m["settlement_schedule"], m["settlement_frequency"],
          m["reserve_account_balance_usd"], m["linked_routing_number"],
          m["linked_account_number_last4"], m["status"], m["risk_tier"],
          m["phone_number"]) for m in merchants],
    )

    events = build_settlement_events(merchants, rows=11_000)
    cur.executemany(
        """INSERT INTO settlement_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        events,
    )

    cur.executemany(
        """INSERT INTO bank_downtime_events VALUES (?,?,?,?,?,?,?)""",
        build_downtime(),
    )

    cur.executemany(
        """INSERT INTO chargebacks VALUES (?,?,?,?,?,?,?,?)""",
        build_chargebacks(merchants),
    )

    # Helpful indexes
    cur.executescript("""
        CREATE INDEX idx_events_mid ON settlement_events(merchant_id);
        CREATE INDEX idx_events_init ON settlement_events(initiated_at);
        CREATE INDEX idx_events_payout ON settlement_events(payout_id);
        CREATE INDEX idx_events_status ON settlement_events(status);
        CREATE INDEX idx_chargebacks_mid ON chargebacks(merchant_id);
        CREATE INDEX idx_chargebacks_txn ON chargebacks(transaction_id);
    """)

    conn.commit()
    conn.close()

    with open(REGISTRY_JSON, "w") as f:
        json.dump(merchants, f, indent=2)

    print(f"Wrote {DB_PATH}")
    print(f"Wrote {REGISTRY_JSON}")
    print(f"  merchants:           {len(merchants)}")
    print(f"  settlement_events:   {len(events)}")
    print(f"  chargebacks:         {len(build_chargebacks(merchants))}  (regenerated for count)")
    print(f"  downtime windows:    {len(build_downtime())}")


if __name__ == "__main__":
    main()
