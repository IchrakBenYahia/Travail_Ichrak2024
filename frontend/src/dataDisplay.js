import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import "./dataDisplay.css";
import logo from "./assets/Logo.png";
import debounce from 'lodash/debounce';

const DataDisplay = () => {
    const [data, setData] = useState([]);
    const [Groups, setGroups] = useState({});
    
    const fetchData = async () => {
        try {
            //const response = await axios.get('http://localhost:5000/api/sensors');
            const response = await axios.get('/backend/api/sensors');
            console.log(response.data); 
            setData(response.data);
        } catch (error) {
            console.error('Erreur lors de la récupération des données:', error);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            fetchData();
        }, 60000); // Rafraîchir toutes les 1 minute (60 000 ms)
        return () => clearInterval(interval); // Nettoyage du setInterval lors du démontage du composant
    }, []);

    
    // Fonction pour extraire le préfixe de base sans le type de capteur
    const extractBasePrefix = (name) => {
        const parts = name.split('_');
        return parts.slice(0, -1).join('_');
    };

    // Fonction pour extraire et formater le préfixe de base
    const extractBasePrefixcapteur = useCallback((name) => {
        const originalName = name;
        const match = name.match(/RACK\d+/);
        return match ? match[0] : originalName;
    }, []);
    
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

    const renderValue = (sensor ) => {
        if (sensor.value === 'Error: No SNMP response received before timeout') {
            return <span style={{ color: 'red' }}>Erreur</span>;
        }

        let val = parseFloat(sensor.value);
        const name = sensor.name.toUpperCase();
        const isNumeric = !isNaN(val) && isFinite(val);

        const isOutOfRange = isNumeric && (val > sensor.high_threshold || val < sensor.low_threshold);
        if  (name.includes("SOUFFLAGE") || name.includes("REPRISE") || name.includes("COURANT")){val=val/10;}
        return <span style={{ color: isOutOfRange ? 'red' : '#4CAF50' }}>{val}{sensor.unit}</span>;
    };

    function convertSeconds(seconds) {
        // Convertir l'entrée en nombre, au cas où elle serait une chaîne
        seconds = Number(seconds);
    
        // Vérifier si l'entrée est maintenant un nombre valide
        if (!isNaN(seconds) && seconds >= 0) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
    
            // Construire la chaîne de résultat avec les valeurs non nulles uniquement
            let result = [];
    
            if (hours > 0) result.push(`${hours} heure${hours > 1 ? 's' : ''}`);
            if (minutes > 0) result.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
            if (secs > 0 || result.length === 0) result.push(`${secs} seconde${secs > 1 ? 's' : ''}`);
    
            return <span style={{ color: 'blue' }}>{result.join(', ')}</span>;
        } else {
            return <span style={{ color: 'red' }}>Erreur</span>;
        }
    }    

    const saveSeuils = async () => {
        try {
            //const response = await axios.post('http://localhost:5000/api/UpdateSeuils', Groups);
            const response = await axios.post('/backend/api/UpdateSeuils', Groups);
            console.log('Thresholds saved successfully:', response.data);
        } catch (err) {
            console.log('Error saving thresholds:', err.response ? err.response.data : err.message);
        }
    };

    const handleSeuilChange =debounce((key, id, newSeuil) => {
        setGroups(prevGroups => {
            // Créer une copie des données actuelles
            const updatedGroups = { ...prevGroups };
        
            // Trouver l'array correspondant au `key`
            const groupArray = updatedGroups[key];
        
            if (groupArray) {
                // Trouver l'index de l'objet avec l'id correspondant
                const objIndex = groupArray.findIndex(obj => obj.id === id);
        
                if (objIndex !== -1) {
                    // Mettre à jour l'objet avec les nouvelles valeurs
                    groupArray[objIndex] = { ...groupArray[objIndex], ...newSeuil };
                }
            }
        
            return updatedGroups;
        });
        
        // Affiche les groupes mis à jour dans la console pour vérification
        console.log(Groups);
        
    }, 200);  // 200ms delay   

    const handleBlur = () => {
        // Sauvegarde les changements dans la base de données lorsque le focus est perdu
        saveSeuils();
    };

   // Regrouper les capteurs en fonction de leur groupe
   useEffect(() => {
    const groupedData = data.reduce((groups, sensor) => {
        const name = sensor.name.toUpperCase();
        const group = sensor.group_name.toUpperCase();

        if (name.includes("HUMIDITE")) {
            groups["Humidite"] = groups["Humidite"] || [];
            groups["Humidite"].push(sensor);
        } else if (name.includes("ENTRÉE") || name.includes("ENTREE")) {
            const groupKey = group.includes("ONDULEUR A") ? "Onduleur_A_ENTREE" : "Onduleur_B_ENTREE";
            groups[groupKey] = groups[groupKey] || [];
            groups[groupKey].push(sensor);
        } else if (name.includes("SORTIE")) {
            const groupKey = group.includes("ONDULEUR A") ? "Onduleur_A_SORTIE" : "Onduleur_B_SORTIE";
            groups[groupKey] = groups[groupKey] || [];
            groups[groupKey].push(sensor);
        } else if (name.includes("AUTONOMIE")) {
            const groupKey = group.includes("ONDULEUR A") ? "Onduleur_A_Autonomie" : group.includes("ONDULEUR B") ? "Onduleur_B_Autonomie" : null;
            if (groupKey) {
                groups[groupKey] = groups[groupKey] || [];
                groups[groupKey].push(sensor);
            }
        } else if (name.includes("TENSION") || name.includes("COURANT")) {
            const groupKey = 
                group.includes("PDU -B- R017") ? "PDU_B_R017" :
                group.includes("PDU -A- R017") ? "PDU_A_R017" :
                group.includes("PDU -A- R01") ? "PDU_A_R01" :
                group.includes("PDU -B- R01") ? "PDU_B_R01" :
                "Other"; 
            groups[groupKey] = groups[groupKey] || [];
            groups[groupKey].push(sensor);
        } else if (name.includes("SOUFFLAGE") || name.includes("REPRISE")) {
            const groupKey = name.includes("SOUFFLAGE") ? "Soufflage" : "Reprise";
            groups[groupKey] = groups[groupKey] || [];
            groups[groupKey].push(sensor);
        } else if (name.includes("BAS") || name.includes("MILIEU") || name.includes("HAUT")) {
            const basePrefix = extractBasePrefix(name);
            groups[basePrefix] = groups[basePrefix] || [];
            groups[basePrefix].push(sensor);
        }

        return groups;
    }, {});

    setGroups(groupedData);
    console.log(groupedData);
}, [data]);
    return (
        <>
            <div className="logo-container">
                <img src={logo} alt="Logo" className="logo" />
            </div>
            <div className="container">
                <div className="tables-wrapper">
                    <div className="group">
                        <h5 className="text">Températures racks</h5>
                        {Object.keys(Groups).filter(key => key.includes("DCM")).map((key, index) => (
                            <div key={index} className="temperature-group">
                                <table>
                                    <thead>
                                        <tr>
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Min</td>
                                            <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Max</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Groups[key].map((sensor, sensorIndex) => (
                                            <tr key={sensorIndex}>
                                                {sensorIndex === 0 && (
                                                    <td rowSpan={Groups[key].length}  className="sensor-name-column vertical-text">
                                                        {extractBasePrefixcapteur(key)}
                                                    </td>
                                                )}
                                                <td>{extractBasePrefixName(sensor.name)}</td>
                                                <td>{renderValue(sensor)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            style={{ width: '40px',  padding: '0 10px' ,border: 'none'}}
                                                            aria-label="Seuil minimum"
                                                            aria-describedby="inputGroup-sizing-sm"
                                                            value={sensor.low_threshold}
                                                            onChange={(e) => handleSeuilChange(key,sensor.id,{ low_threshold: e.target.value })}
                                                            onBlur={handleBlur}
                                                        />
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input
                                                            type="number" 
                                                            className="form-control"
                                                            style={{ width: '40px', padding: '0 10px' ,border: 'none'}}
                                                            aria-label="Seuil minimum"
                                                            aria-describedby="inputGroup-sizing-sm"
                                                            value={sensor.high_threshold}
                                                            onChange={(e) => handleSeuilChange(key,sensor.id, { high_threshold: e.target.value })}
                                                            onBlur={handleBlur}
                                                        />
                                                    </div>
                                                </td>
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
                            {Groups["Humidite"]? 
                            <thead>
                                <tr>
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Min</td>
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Max</td>
                                </tr>
                            </thead>:null}
                            <tbody>
                                {Groups["Humidite"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        {sensorIndex === 0 && (
                                            <td rowSpan={Groups["Humidite"].length} style={{ color: 'blue' }} className="sensor-name-column vertical-text">
                                                Humidité
                                            </td>
                                        )}
                                        <td>{extractBasePrefixName(sensor.name)}</td>
                                        <td>{renderValue(sensor)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.low_threshold}
                                                    onChange={(e) => handleSeuilChange("Humidite", sensor.id, { low_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.high_threshold}
                                                    onChange={(e) => handleSeuilChange("Humidite",sensor.id, { high_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="group">
                        <h5 className="text">Onduleur A</h5>
                        <table>
                        {Groups["Onduleur_A_ENTREE"]? 
                            <thead>
                                <tr>
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Min</td>
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Max</td>
                                </tr>
                            </thead> : null}
                            <tbody>
                                {Groups["Onduleur_A_ENTREE"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.name}</td>
                                        <td>{renderValue(sensor)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.low_threshold}
                                                    onChange={(e) => handleSeuilChange("Onduleur_A_ENTREE",sensor.id, { low_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.high_threshold}
                                                    onChange={(e) => handleSeuilChange("Onduleur_A_ENTREE",sensor.id, { high_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                               />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <br></br>
                        <h5 style={{ color: 'blue' }} className="text">Autonomie</h5>
                        <table>
                            <tbody>
                                {Groups["Onduleur_A_Autonomie"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>
                                        {sensor.value === 'Error: No SNMP response received before timeout' ? (
                                            <span style={{ color: 'red' }}>Erreur</span>
                                        ) : (
                                            <span style={{ color: 'blue' }}>
                                                {convertSeconds(sensor.value)} ({sensor.value})
                                            </span>
                                        )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <br></br>
                        <table>
                        {Groups["Onduleur_A_SORTIE"]?
                            <thead>
                                <tr>
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Min</td>
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Max</td>
                                </tr>
                            </thead> : null }
                            <tbody>
                                {Groups["Onduleur_A_SORTIE"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.name}</td>
                                        <td>{renderValue(sensor)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    step={sensor.name.includes("Courant") ? "0.1" : undefined} 
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.low_threshold}
                                                    onChange={(e) => handleSeuilChange("Onduleur_A_SORTIE",sensor.id, { low_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    step={sensor.name.includes("Courant") ? "0.1" : undefined} 
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.high_threshold}
                                                    onChange={(e) => handleSeuilChange("Onduleur_A_SORTIE",sensor.id, { high_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="group">
                        <h5 className="text">Onduleur B</h5>
                        <table>
                        {Groups["Onduleur_B_ENTREE"]?
                            <thead>
                                <tr>
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Min</td>
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Max</td>
                                </tr>
                            </thead> : null }
                            <tbody>
                                {Groups["Onduleur_B_ENTREE"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.name}</td>
                                        <td>{renderValue(sensor)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.low_threshold}
                                                    onChange={(e) => handleSeuilChange("Onduleur_B_ENTREE",sensor.id, { low_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.high_threshold}
                                                    onChange={(e) => handleSeuilChange("Onduleur_B_ENTREE",sensor.id, { high_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <br></br>
                        <h5 style={{ color: 'blue' }} className="text">Autonomie</h5>
                        <table>
                            <tbody>
                                {Groups["Onduleur_B_Autonomie"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>
                                        {sensor.value === 'Error: No SNMP response received before timeout' ? (
                                            <span style={{ color: 'red' }}>Erreur</span>
                                        ) : (
                                            <span style={{ color: 'blue' }}>
                                                {convertSeconds(sensor.value)} ({sensor.value})
                                            </span>
                                        )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <br></br>
                        <table>
                        {Groups["Onduleur_B_SORTIE"]?
                            <thead>
                                <tr>
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Min</td>
                                    <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Max</td>
                                </tr>
                            </thead> : null }
                            <tbody>
                                {Groups["Onduleur_B_SORTIE"]?.map((sensor, sensorIndex) => (
                                    <tr key={sensorIndex}>
                                        <td>{sensor.name}</td>
                                        <td>{renderValue(sensor)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    step={sensor.name.includes("Courant") ? "0.1" : undefined} 
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.low_threshold}
                                                    onChange={(e) => handleSeuilChange("Onduleur_B_SORTIE",sensor.id, { low_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    step={sensor.name.includes("Courant") ? "0.1" : undefined} 
                                                    className="form-control"
                                                    style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                    aria-label="Seuil minimum"
                                                    aria-describedby="inputGroup-sizing-sm"
                                                    value={sensor.high_threshold}
                                                    onChange={(e) => handleSeuilChange("Onduleur_B_SORTIE",sensor.id,{ high_threshold: e.target.value })}
                                                    onBlur={handleBlur}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="group">
                        <h5 className="text">PDU</h5>
                        {Object.keys(Groups).filter(key => key.startsWith("PDU_")).map((key, index) => (
                            <div key={index} className="pdu-group">
                                <table>
                                    <thead>
                                        <tr>
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Min</td>
                                            <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Max</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Groups[key].map((sensor, sensorIndex) => (
                                            <tr key={sensorIndex}>
                                                {sensorIndex === 0 && (
                                                    <td rowSpan={Groups[key].length}  className="sensor-name-column vertical-text">
                                                        {extractBasePrefixcapteur(key)}
                                                    </td>
                                                )}
                                                <td>{sensor.name}</td>
                                                <td>{renderValue(sensor)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            step={sensor.name.includes("Courant") ? "0.1" : undefined} 
                                                            className="form-control"
                                                            style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                            aria-label="Seuil minimum"
                                                            aria-describedby="inputGroup-sizing-sm"
                                                            value={sensor.low_threshold}
                                                            onChange={(e) => handleSeuilChange(key,sensor.id, { low_threshold: e.target.value })}
                                                            onBlur={handleBlur}
                                                        />
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            step={sensor.name.includes("Courant") ? "0.1" : undefined} 
                                                            className="form-control"
                                                            style={{ width: '40px',   padding: '0 10px' ,border: 'none'}}
                                                            aria-label="Seuil minimum"
                                                            aria-describedby="inputGroup-sizing-sm"
                                                            value={sensor.high_threshold}
                                                            onChange={(e) => handleSeuilChange(key,sensor.id, { high_threshold: e.target.value })}
                                                            onBlur={handleBlur}
                                                        />
                                                    </div>
                                                </td>
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
                        {Object.keys(Groups)
                                .filter(key => key.startsWith("Soufflage") || key.startsWith("Reprise"))
                                .map((key, index) => (
                            <div key={index} className="cooling-group">
                                <h5 className="text">{key}</h5>
                                <table>
                                    <thead>
                                        <tr>
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ border: 'none' }}></td> {/* Cellule vide pour aligner */}
                                            <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Min</td>
                                            <td style={{ fontWeight: 'normal', border: 'none' }}>Seuil Max</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Groups[key].map((sensor, sensorIndex) => (
                                            <tr key={sensorIndex}>
                                                {sensorIndex === 0 && (
                                                    <td rowSpan={Groups[key].length} className="sensor-name-column vertical-text">
                                                        Climatisation
                                                    </td>
                                                )}
                                                <td>{extractBasePrefixName(sensor.name)}</td>
                                                <td>{renderValue(sensor)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            step="0.1" 
                                                            className="form-control"
                                                            style={{ width: '50px',   padding: '0 10px' ,border: 'none'}}
                                                            aria-label="Seuil minimum"
                                                            aria-describedby="inputGroup-sizing-sm"
                                                            value={sensor.low_threshold}
                                                            onChange={(e) => handleSeuilChange(key,sensor.id,{ low_threshold: e.target.value })}
                                                            onBlur={handleBlur}
                                                        />
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            step="0.1" 
                                                            className="form-control"
                                                            style={{ width: '50px',   padding: '0 10px' ,border: 'none'}}
                                                            aria-label="Seuil minimum"
                                                            aria-describedby="inputGroup-sizing-sm"
                                                            value={sensor.high_threshold}
                                                            onChange={(e) => handleSeuilChange(key,sensor.id, { high_threshold: e.target.value })}
                                                            onBlur={handleBlur}
                                                        />
                                                    </div>
                                                </td>
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
