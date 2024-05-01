const {google} = require('googleapis');
const _ = require('lodash');
const path = require('path');
const moment = require('moment')
const dotenv = require("dotenv");
const {getEntriesByDay, getMonthArg, getArgs, base64, getEnvVar} = require("./utils");

const credentials = require(path.resolve(__dirname, './credentials.json'));

dotenv.config({path: '.env.local'})

const togglAuth = `Basic ${base64(`${getEnvVar('TOGGL_API_TOKEN', true)}:api_token`)}`;

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/documents'],
});

const docs = google.docs({version: 'v1', auth});

const formatDecimalNumber = number => new Intl.NumberFormat('de-DE', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
}).format(number);

const togglEntriesToInvoiceRows = (entriesByDay, hourlyRate) => entriesByDay.map(entry => {
    const date = moment(entry.day).format('DD.MM.YYYY')
    const hours = formatDecimalNumber(entry.hoursTotalDecimal)
    const price = hourlyRate + ''
    const totalPrice = formatDecimalNumber(entry.hoursTotalDecimal * hourlyRate)

    return {
        date,
        hours,
        price,
        totalPrice
    }
})

const getDocContent = async documentId => {
    const {data: docContent} = await docs.documents.get({
        documentId: documentId,
    })
    return docContent
}

const updateDoc = async (documentId, requests) => docs.documents.batchUpdate(
    {
        auth,
        documentId: documentId,
        requestBody: {
            requests,
        },
    }
)

function getTable(docContent) {
    return _.find(docContent.body.content, child => _.has(child, 'table'));
}

const insertTextRequest = (index, text) => ({
    insertText: {
        location: {
            index
        },
        text
    }
})

function replaceTextRequest(variable, value) {
    return {
        replaceAllText: {
            containsText: {
                text: `{${variable}}`,
                matchCase: true,
            },
            replaceText: value,
        }
    };
}

function insertTableRowRequest(tableStartIndex) {
    return {
        'insertTableRow': {
            'tableCellLocation': {
                'tableStartLocation': {
                    'index': tableStartIndex
                },
                'rowIndex': 0,
                'columnIndex': 0
            },
            'insertBelow': 'true'
        }
    };
}

async function writeGoogleDoc(params) {
    const {monthArg, documentId, invoiceNo, hourlyRate} = params

    const entries = await getEntriesByDay(monthArg, togglAuth)
    const invoiceRows = togglEntriesToInvoiceRows(entries, hourlyRate)

    const totalHours = entries.map(day => day.hoursTotalDecimal).reduce((sum, dayTotal) => sum + dayTotal, 0)
    const totalPrice = totalHours * hourlyRate

    const startDate = moment(monthArg + '-01', 'YYYY-MM-DD').format('DD.MM.YYYY')
    const endDate = moment(monthArg + '-01', 'YYYY-MM-DD').endOf('month').format('DD.MM.YYYY')
    const billingDate = moment().format('DD.MM.YYYY')
    const payableDate = moment().add(30, 'day').format('DD.MM.YYYY')

    try {
        await updateDoc(documentId, [
            replaceTextRequest('invoiceNo', invoiceNo),
            replaceTextRequest('from', startDate),
            replaceTextRequest('to', endDate),
            replaceTextRequest('billingDate', billingDate),
            replaceTextRequest('payableDate', payableDate),
            replaceTextRequest('totalPrice', formatDecimalNumber(totalPrice))
        ])

        let docContent = await getDocContent(documentId)

        const tableStartIndex = getTable(docContent).startIndex
        await updateDoc(documentId, invoiceRows.map(() => insertTableRowRequest(tableStartIndex)))

        docContent = await getDocContent(documentId)

        const tableRows = getTable(docContent).table.tableRows

        const tableTextRequests = []

        // update texts in reverse order (otherwise start indexes outdated after first update)
        for (let i = invoiceRows.length - 1; i >= 0; i--) {
            const record = invoiceRows[i];

            tableTextRequests.push(insertTextRequest(tableRows[1 + i].tableCells[3].content[0].startIndex, record.totalPrice))
            tableTextRequests.push(insertTextRequest(tableRows[1 + i].tableCells[2].content[0].startIndex, record.price))
            tableTextRequests.push(insertTextRequest(tableRows[1 + i].tableCells[1].content[0].startIndex, record.hours))
            tableTextRequests.push(insertTextRequest(tableRows[1 + i].tableCells[0].content[0].startIndex, record.date))
        }

        await updateDoc(documentId, tableTextRequests)

        console.log(`Completed! (Total hours: ${formatDecimalNumber(totalHours)})`)
    } catch (error) {
        console.error('Error writing invoice:', error);
        console.log(`Did you grant Editor access to the service account '${credentials.client_email}'?`)
    }
}

async function writeInvoice() {
    const monthArg = getMonthArg()

    if (!monthArg) {
        console.error('Provide month arg as first argument in format YYYY-MM (e.g. 2023-12)')
        return
    }

    const args = getArgs();

    const invoiceNo = args[1]
    if (!invoiceNo) {
        console.error('Provide invoice no. as second argument')
        return
    }

    const hourlyRateArg = args[2];
    if (!hourlyRateArg || !/^\d+$/.test(hourlyRateArg)) {
        console.error('Provide hourly rate as integer as 3rd argument')
        return
    }
    const hourlyRate = parseInt(hourlyRateArg);

    const documentId = args[3]
    if (!documentId) {
        console.error('Provide the id of the Google Document as 4th argument')
        return
    }

    const params = {
        monthArg,
        documentId,
        invoiceNo,
        hourlyRate
    }

    await writeGoogleDoc(params)
}

writeInvoice()



