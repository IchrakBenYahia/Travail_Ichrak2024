import logging
from flask import Flask, request, jsonify
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
from mysql.connector import pooling
from concurrent.futures import ThreadPoolExecutor
import time

# Configure logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)

dbconfig = {
    #'host': 'localhost',
    'host': 'database',
    'user': 'root',
    #'password': '',
    'password': 'pass',
    'database': 'monitoring'
}

connection_pool = pooling.MySQLConnectionPool(pool_name="mypool",
                                              pool_size=32,
                                              **dbconfig)

def get_db_connection():
    """Get a connection from the pool."""
    return connection_pool.get_connection()

def get_snmp_data(oids, oid_names, ips):
    def fetch_snmp(oid, name, ip):
        time.sleep(0.5)  # Introduit un délai de 0.5 seconde entre chaque requête SNMP GET
        iterator = getCmd(
            SnmpEngine(),
            CommunityData('public', mpModel=0),
            UdpTransportTarget((ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        )
        errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
        if errorIndication:
            return {"name": name, "value": f"Error: {errorIndication}"}
        elif errorStatus:
            return {"name": name, "value": f"Error: {errorStatus.prettyPrint()}"}
        else:
            for varBind in varBinds:
                oid_value = varBind[1].prettyPrint()
                return {"name": name, "value": oid_value}

    max_workers = min(32, len(oids))  # Dynamically set based on the number of OIDs/devices
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(fetch_snmp, oids, oid_names, ips))

    return results

def update_and_save_sensors(results, snmp_data):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    update_query = "UPDATE sensors SET value = CASE id "
    ids = []
    for i, data in enumerate(snmp_data):
        sensor_id = results[i]['id']
        new_value = data['value']
        update_query += f"WHEN {sensor_id} THEN '{new_value}' "
        ids.append(sensor_id)

    update_query += "END WHERE id IN ({})".format(','.join(map(str, ids)))
    cursor.execute(update_query)

    # Insertion de l'historique
    history_data = []
    for i, data in enumerate(snmp_data):
        history_data.append((
            results[i]['name'], results[i]['ip'], results[i]['oid'],
            data['value'], results[i]['unit'], results[i]['high_threshold'],
            results[i]['low_threshold'], results[i]['group_name'], datetime.now()
        ))

    history_query = """
        INSERT INTO sensors_history (name, ip, oid, value, unit, high_threshold, low_threshold, group_name, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.executemany(history_query, history_data)

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

    # Update results with SNMP values
    for i, data in enumerate(snmp_data):
        results[i]['value'] = data['value']

    # Start a background thread to update and save sensor data
    thread = Thread(target=update_and_save_sensors, args=(results, snmp_data))
    thread.start()

    cursor.close()
    connection.close()

    return jsonify(results)

@app.route('/api/UpdateSeuils', methods=['POST'])
def update_seuils():
    try:
        data = request.json  # Récupère les données JSON envoyées par le frontend
        connection = get_db_connection()
        cursor = connection.cursor()
        
        for key, sensors in data.items():
            for sensor in sensors:
                update_query = """
                    UPDATE sensors
                    SET high_threshold = %s, low_threshold = %s
                    WHERE id = %s
                """
                cursor.execute(update_query, (sensor['high_threshold'], sensor['low_threshold'], sensor['id']))

        connection.commit()
        cursor.close()
        connection.close()
        return jsonify({"message": "Thresholds updated successfully"}), 200
    except Exception as e:
        logging.error(f"Error updating thresholds: {e}")
        return jsonify({"error": str(e)}), 500 
    
if __name__ == '__main__':

    app.run(debug=True, host='0.0.0.0', port=5000) 
