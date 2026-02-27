const db = require('./models/db-sqlite');

async function checkPaymentProofs() {
    try {
        const proofs = await db.all('SELECT * FROM payment_proofs ORDER BY created_at DESC LIMIT 5', []);
        console.log('Recent payment proofs:');
        console.log(JSON.stringify(proofs, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkPaymentProofs();