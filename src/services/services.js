const { google } = require('googleapis');

// ---- Google Sheets ----
const SPREADSHEET_ID = '1AvY9poY7O_u6JW3qS7pmphqWX_MHRUdUK4xx6Ci7Nu4';

const auth = new google.auth.GoogleAuth({
    keyFile: 'users-490623-c1685ec18f40.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function getUsers() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Hoja 1'!A2:D",
    });
    return res.data.values || [];
}

async function existUser(numero) {
    const filas = await getUsers();
    return filas.some(fila => fila[2] === numero);
}

async function addUser(numero, nombre) {
    const filas = await getUsers();
    const ultimoId = filas.length > 0 ? parseInt(filas[filas.length - 1][0]) : 0;
    const nuevoId = ultimoId + 1;
    const fechaRegistro = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Hoja 1'!A2:D",
        valueInputOption: 'RAW',
        requestBody: {
            values: [[nuevoId, nombre, numero, fechaRegistro]]
        },
    });
    console.log('Usuario agregado:', numero, 'nombre:', nombre);
}

// Al final de services.js
module.exports = { getUsers, existUser, addUser };