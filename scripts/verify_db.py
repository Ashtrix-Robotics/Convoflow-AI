import psycopg2, sys

conn = psycopg2.connect(
    host="db.dwswmirwfsqkerybszsg.supabase.co",
    port=5432,
    user="postgres",
    password="DarksoulZ0193$",
    dbname="postgres"
)
cur = conn.cursor()
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
tables = [r[0] for r in cur.fetchall()]
print("Tables in Supabase:")
for t in tables:
    print(f"  {t}")
if not tables:
    print("  (none found - migration may have failed)")
    sys.exit(1)
conn.close()
print("OK - schema verified")
