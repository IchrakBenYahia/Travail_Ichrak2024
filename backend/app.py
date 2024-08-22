import logging
from flask import Flask, jsonify
from flask_cors import CORS
import mysql.connector
from pysnmp.hlapi import *
from apscheduler.schedulers.background import BackgroundScheduler
from threading import Thread
import logging
from datetime import datetime
from pysnmp.hlapi import (
    SnmpEngine,
    CommunityData,
    UdpTransportTarget,
    ContextData,
    ObjectType,
    ObjectIdentity,
    getCmd
)

# Configure logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'monitoring'
}

def get_db_connection():
    """Establish and return a new database connection."""
    return mysql.connector.connect(**DB_CONFIG)

def get_snmp_data(oids, oid_names, ips):
    """Retrieve SNMP data for given OIDs, names, and IPs."""
    result = []
    for oid, name, ip in zip(oids, oid_names, ips):
        iterator = getCmd(
            SnmpEngine(),
            CommunityData('public', mpModel=0),  # 'public' is the community string, 'mpModel=0' corresponds to SNMPv1
            UdpTransportTarget((ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        )
        errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
        if errorIndication:
            result.append({"name": name, "value": f"Error: {errorIndication}"})
        elif errorStatus:
            result.append({"name": name, "value": f"Error: {errorStatus.prettyPrint()}"})
        else:
            for varBind in varBinds:
                oid_value = varBind[1].prettyPrint()
                # logging.info(f"SNMP Data: {name} = {oid_value} for OID {oid} on IP {ip}")
                result.append({"name": name, "value": oid_value})
   
    return result


def update_and_save_sensors(results, snmp_data):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    for i, data in enumerate(snmp_data):
        sensor_id = results[i]['id']
        new_value = data['value']

        update_query = "UPDATE sensors SET value = %s WHERE id = %s"
        cursor.execute(update_query, (new_value, sensor_id))

        history_query = """
            INSERT INTO sensors_histoty (name, ip, oid, value, unit, high_threshold, low_threshold, group_name, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(history_query, (
            results[i]['name'], results[i]['ip'], results[i]['oid'],
            new_value, results[i]['unit'], results[i]['high_threshold'],
            results[i]['low_threshold'], results[i]['group_name'], datetime.now()
        ))

    connection.commit()
    cursor.close()
    connection.close()
    logging.info("Sensors data updated and saved to history.")

@app.route('/api/sensors', methods=['GET'])
def get_sensors():
    """Fetch sensors data and return as JSON."""
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT s.id, s.name, s.ip, s.oid, s.value, s.unit, s.high_threshold, s.low_threshold, g.group_name
        FROM sensors s
        JOIN sensor_groups g ON s.group_id = g.id
    """
    cursor.execute(query)
    results = cursor.fetchall()

    oids = [result['oid'] for result in results]
    names = [result['name'] for result in results]
    ips = [result['ip'] for result in results]

    snmp_data = get_snmp_data(oids, names, ips)
    logging.info("Data fetched from SNMP.")

    # Start a background thread to update and save sensor data
    thread = Thread(target=update_and_save_sensors, args=(results, snmp_data))
    thread.start()

    cursor.close()
    connection.close()

    return jsonify(results)

if __name__ == '__main__':
    scheduler = BackgroundScheduler()
    scheduler.add_job(get_sensors, 'interval', minutes=3)  # Run every 5 minutes
    scheduler.start()

    app.run(debug=True, host='0.0.0.0', port=5000)
