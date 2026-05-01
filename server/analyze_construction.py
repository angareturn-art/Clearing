import sqlite3
import json
from pathlib import Path

db_path = Path(__file__).parent / 'construction.db'

conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

try:
    # 모든 테이블 조회
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = cursor.fetchall()
    
    print("=== 데이터베이스 테이블 ===")
    table_names = [row['name'] for row in tables]
    print(json.dumps(table_names, indent=2, ensure_ascii=False))
    
    # 각 테이블의 스키마 조회
    print("\n=== 테이블 스키마 ===")
    for table_name in table_names:
        cursor.execute(f"PRAGMA table_info({table_name});")
        schema = cursor.fetchall()
        print(f"\n[{table_name}]")
        for col in schema:
            print(f"  {col['name']}: {col['type']}")
    
    # buildings 테이블 데이터
    if 'buildings' in table_names:
        print("\n=== buildings 테이블 데이터 ===")
        cursor.execute("SELECT * FROM buildings;")
        buildings = cursor.fetchall()
        for row in buildings:
            print(dict(row))
    
    # sites 테이블 데이터
    if 'sites' in table_names:
        print("\n=== sites 테이블 데이터 ===")
        cursor.execute("SELECT * FROM sites;")
        sites = cursor.fetchall()
        for row in sites:
            print(dict(row))
    
    # units 테이블 데이터 (처음 50개)
    if 'units' in table_names:
        print("\n=== units 테이블 데이터 (처음 50개) ===")
        cursor.execute("SELECT * FROM units LIMIT 50;")
        units = cursor.fetchall()
        for row in units:
            print(dict(row))
        
        cursor.execute("SELECT COUNT(*) as count FROM units;")
        count = cursor.fetchone()
        print(f"\n총 units 개수: {count['count']}")

except Exception as error:
    print(f'DB 조회 오류: {error}')

finally:
    conn.close()
