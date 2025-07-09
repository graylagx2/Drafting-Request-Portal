import sqlite3

conn = sqlite3.connect("instance/kern_energy_nexus.db")

rows = conn.execute(
     "SELECT name FROM sqlite_master WHERE type='table';"
).fetchall()

for (name,) in rows:
     print(name)