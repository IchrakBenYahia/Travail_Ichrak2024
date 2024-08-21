import threading
import time
from flask import Flask, jsonify, request
from pysnmp.hlapi import *
from flask_cors import CORS
import mysql.connector
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)

# SNMP server details
IP_ADDRESS = '41.226.179.43'
COMMUNITY = 'public'

# Fonction pour se connecter à la base de données MySQL
def connect_to_mysql():
    connection = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',  
        database='monitoring'  
    )
    return connection

# Function to get SNMP data
def get_snmp_data(oids, oid_names, ips):
    result = []
    for oid, name, ip in zip(oids, oid_names, ips):
        iterator = getCmd(
            SnmpEngine(),
            CommunityData(COMMUNITY),
            UdpTransportTarget((ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        )
        errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
        if errorIndication:
            print("test1")
            result.append({"name": name, "value": f"Error: {errorIndication}"})
        elif errorStatus:
            print("test2")
            result.append({"name": name, "value": f"Error: {errorStatus.prettyPrint()}"})
        else:
            print("snmp_data")
            for varBind in varBinds:
                oid_value = varBind[1].prettyPrint()
                result.append({"name": name, "value": oid_value})
    return result

@app.route('/api/sensors', methods=['GET'])
def get_sensors():
    connection = connect_to_mysql()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT s.id, s.name, s.ip, s.oid, s.value, s.unit, s.high_threshold, g.group_name AS group_name
        FROM sensors s
        JOIN sensor_groups g ON s.group_id = g.id
    """
    cursor.execute(query)
    results = cursor.fetchall()

    # # Extract OIDs and names for SNMP queries
    # oids = [result['oid'] for result in results]
    # names = [result['name'] for result in results]
    # ips = [result['ip'] for result in results]
    # print(oids,"**************",names,"**************",ips,"**************")
    # # Get SNMP data
    # snmp_data = get_snmp_data(oids,names,ips)
    # print(snmp_data)

    # # Update results with SNMP values
    # for i, data in enumerate(snmp_data):
    #     results[i]['value'] = data['value']

    cursor.close()
    connection.close()

    return jsonify(results)

if __name__ == '__main__':
    
    # Lancer le serveur Flask
    app.run(debug=True, host='0.0.0.0', port=5000)
