import React, { useEffect, useState } from "react";
import axios from "axios";
import "./dataDisplay.css";
import logo from "./assets/Logo.png";

const DataDisplay = () => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/sensors');
                //const response = await axios.get('/backend/api/sensors');
                console.log(response.data); 
                setData(response.data);
            } catch (error) {
                console.error('Erreur lors de la récupération des données:', error);
            }
        };

        fetchData();
    }, []);

    // Fonction pour extraire le préfixe de base sans le type de capteur
    const extractBasePrefix = (name) => {
        const parts = name.split('_');
        return parts.slice(0, -1).join('_');
    };

    // Fonction pour extraire et formater le préfixe de base
const extractBasePrefixcapteur = (name) => {
    const originalName = name; // Conserver le nom d'origine pour retour

    const match = name.match(/RACK\d+/); // Trouve le motif RACK suivi de chiffres
    return match ? match[0] : originalName; // Retourne le match ou le nom d'origine si aucun match
    }
// Fonction pour extraire et formater le préfixe de base
const extractBasePrefixName = (name) => {
    const originalName = name; // Conserver le nom d'origine pour retour

    // Gestion des cas pour HUMIDITE, BAS, MILIEU, HAUT, COOLING
    if (name.includes("HUMIDITE") ) {
        const match = name.match(/RACK\d+/); // Trouve le motif RACK suivi de chiffres
        return match ? match[0] : originalName; // Retourne le match ou le nom d'origine si aucun match
    } else if (name.includes("BAS") || name.includes("MILIEU") || name.includes("HAUT")) {
        const suffix = name.includes("BAS") ? "BAS" :
                       name.includes("MILIEU") ? "MILIEU" :
                       name.includes("HAUT") ? "HAUT" : "";
        return suffix ? `${suffix}` : originalName; // Retourne le préfixe RACKxx avec suffixe ou le nom d'origine
    } else if (name.includes("cooling")) {
        const coolingMatch = name.match(/cooling\s*\d+/); // Trouve le motif COOLING suivi de chiffres
        return coolingMatch ? coolingMatch[0] : originalName; // Retourne le match ou le nom d'origine si aucun match
    }
    
    return originalName; // Retourne le nom d'origine si aucune condition n'est remplie
};



    // Regrouper les capteurs en fonction de leur groupe
    const groupedData = data.reduce((groups, sensor) => {
        const name = sensor.name.toUpperCase();
        const group= sensor.group_name.toUpperCase();
        
        if (name.includes("HUMIDITE")) {
            if (!groups["Humidite"]) {
                groups["Humidite"] = [];
            }
            groups["Humidite"].push(sensor);
        } else if (name.includes("ENTRÉE") || name.includes("ENTREE")) {
            const groupKey = group.includes("ONDULEUR A") ? "Onduleur_A_ENTREE" : "Onduleur_B_ENTREE";
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(sensor);
        } else if (name.includes("SORTIE")) {
            const groupKey = group.includes("ONDULEUR A") ? "Onduleur_A_SORTIE" : "Onduleur_B_SORTIE";
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(sensor);
        } else if (name.includes("AUTONOMIE")) {
            const groupKey = group.includes("ONDULEUR A") ? "Onduleur_A_Autonomie" : group.includes("ONDULEUR B") ? "Onduleur_B_Autonomie" : null;
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(sensor);
        } else if (name.includes("TENSION") || name.includes("COURANT")) {
            const groupKey = 
            group.includes("PDU -B- R017") ? "PDU_B_R017" :
            group.includes("PDU -A- R017") ? "PDU_A_R017" :
            group.includes("PDU -A- R01") ? "PDU_A_R01" :
            group.includes("PDU -B- R01") ? "PDU_B_R01" :
            "Other"; // Valeur par défaut si aucune condition n'est remplie
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(sensor);
        } else if (name.includes("SOUFFLAGE") || name.includes("REPRISE")) {
            const groupKey = name.includes("SOUFFLAGE") ? "Soufflage" : "Reprise";
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(sensor);
        } else if (name.includes("BAS") || name.includes("MILIEU") || name.includes("HAUT")) {
            const basePrefix = extractBasePrefix(name);
            if (!groups[basePrefix]) {
                groups[basePrefix] = [];
            }
            groups[basePrefix].push(sensor);
        }
        console.log(groups)
        return groups;
    }, {});

    return (
        <>
            <div className="logo-container">
                <img src={logo} alt="Logo" className="logo" />
            </div>
            <div className="container">
                <div className="tables-wrapper">
                    <div className="group">
                        <h5 className="text">Températures racks</h5>
                        {Object.keys(groupedData).filter(key => key.includes("DCM")).map((key, index) => (
                            <div key={index} className="temperature-group">
                                <table>
                                    <tbody>
                                        {groupedData[key].map((sensor, sensorIndex) => (
                                            <tr key={sensorIndex}>
                                                {sensorIndex === 0 && (
                                                    <td rowSpan={groupedData[key].length}  className="sensor-name-column vertical-text">
                                                        {extractBasePrefixcapteur(key)}
                                                    </td>
                                                )}
                                                <td>{extractBasePrefixName(sensor.name)}</td>
                                                <td>{sensor.value}{sensor.unit}</td>
                                                <td>{sensor.high_threshold}</td>
                                                <td>{sensor.low_threshold}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <br></br>
                            </div>
                        ))}
                    </div>
                    <div className="group">
                        <h5 className="text">Humidité racks</h5>
                        <table>
                            <tbody>
                                {groupedData["Humidite"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        {sensorIndex === 0 && (
                                            <td rowSpan={groupedData["Humidite"].length}  className="sensor-name-column vertical-text">
                                                Humidité racks
                                            </td>
                                        )}
                                        <td>{extractBasePrefixName(sensor.name)}</td>
                                        <td>{sensor.value}{sensor.unit}</td>
                                        <td>{sensor.high_threshold}</td>
                                        <td>{sensor.low_threshold}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="group">
                        <h5 className="text">Onduleur A</h5>
                        <table>
                            <tbody>
                                {groupedData["Onduleur_A_ENTREE"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.name}</td>
                                        <td>{sensor.value}{sensor.unit}</td>
                                        <td>{sensor.high_threshold}</td>
                                        <td>{sensor.low_threshold}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <br></br>
                        <h5 className="text">Autonomie</h5>
                        <table>
                            <tbody>
                                {groupedData["Onduleur_A_Autonomie"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.value}{sensor.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <br></br>
                        <table>
                            <tbody>
                                {groupedData["Onduleur_A_SORTIE"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.name}</td>
                                        <td>{sensor.value}{sensor.unit}</td>
                                        <td>{sensor.high_threshold}</td>
                                        <td>{sensor.low_threshold}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="group">
                        <h5 className="text">Onduleur B</h5>
                        <table>
                            <tbody>
                                {groupedData["Onduleur_B_ENTREE"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.name}</td>
                                        <td>{sensor.value}{sensor.unit}</td>
                                        <td>{sensor.high_threshold}</td>
                                        <td>{sensor.low_threshold}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <br></br>
                        <h5 className="text">Autonomie</h5>
                        <table>
                            <tbody>
                                {groupedData["Onduleur_B_Autonomie"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.value}{sensor.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <br></br>
                        <table>
                            <tbody>
                                {groupedData["Onduleur_B_SORTIE"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.name}</td>
                                        <td>{sensor.value}{sensor.unit}</td>
                                        <td>{sensor.high_threshold}</td>
                                        <td>{sensor.low_threshold}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="group">
                        <h5 className="text">PDU</h5>
                        {Object.keys(groupedData).filter(key => key.startsWith("PDU_")).map((key, index) => (
                            <div key={index} className="pdu-group">
                                <table>
                                    <tbody>
                                        {groupedData[key].map((sensor, sensorIndex) => (
                                            <tr key={sensorIndex}>
                                                {sensorIndex === 0 && (
                                                    <td rowSpan={groupedData[key].length}  className="sensor-name-column vertical-text">
                                                        {extractBasePrefixcapteur(key)}
                                                    </td>
                                                )}
                                                <td>{sensor.name}</td>
                                                <td>{sensor.value}{sensor.unit}</td>
                                                <td>{sensor.high_threshold}</td>
                                                <td>{sensor.low_threshold}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <br></br>
                            </div>
                        ))}
                    </div>
                    <div className="group">
                        <h5 className="text">REFROIDISSEMENT</h5>
                        {Object.keys(groupedData)
                                .filter(key => key.startsWith("Soufflage") || key.startsWith("Reprise"))
                                .map((key, index) => (
                            <div key={index} className="cooling-group">
                                <h5 className="text">{key}</h5>
                                <table>
                                    <tbody>
                                        {groupedData[key].map((sensor, sensorIndex) => (
                                            <tr key={sensorIndex}>
                                                {sensorIndex === 0 && (
                                                    <td rowSpan={groupedData[key].length} className="sensor-name-column vertical-text">
                                                        Climatisation
                                                    </td>
                                                )}
                                                <td>{extractBasePrefixName(sensor.name)}</td>
                                                <td>{sensor.value}{sensor.unit}</td>
                                                <td>{sensor.high_threshold}</td>
                                                <td>{sensor.low_threshold}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DataDisplay;
