const db = require('./models/db-sqlite');

async function checkPayments() {
    try {
        await db.initDB();
        
        console.log('=== CHECKING PAYMENTS FOR ANIN AND AGUS ===\n');
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        console.log(`Current Month-Year: ${currentMonthYear}\n`);
        
        // Get Anin
        const anin = await db.getClientByUsername('anin');
        console.log('ANIN:');
        console.log(`- ID: ${anin.id}`);
        console.log(`- Username: ${anin.pppoe_username}`);
        console.log(`- Phone: ${anin.phone_number}`);
        console.log(`- Monthly Fee: Rp ${anin.monthly_fee}`);
        console.log(`- Payment Status (client table): ${anin.payment_status}`);
        console.log(`- Last Paid Month: ${anin.last_paid_month}`);
        
        const aninPayment = await db.getPaymentByUserAndMonth(anin.id, currentMonthYear);
        console.log(`- Payment Record for ${currentMonthYear}:`, aninPayment ? 'FOUND' : 'NOT FOUND');
        if (aninPayment) {
            console.log(`  Status: ${aninPayment.status}, Amount: Rp ${aninPayment.amount}`);
        }
        
        // Get Agus
        const agus = await db.getClientByUsername('agus');
        console.log('\nAGUS:');
        console.log(`- ID: ${agus.id}`);
        console.log(`- Username: ${agus.pppoe_username}`);
        console.log(`- Phone: ${agus.phone_number}`);
        console.log(`- Monthly Fee: Rp ${agus.monthly_fee}`);
        console.log(`- Payment Status (client table): ${agus.payment_status}`);
        console.log(`- Last Paid Month: ${agus.last_paid_month}`);
        
        const agusPayment = await db.getPaymentByUserAndMonth(agus.id, currentMonthYear);
        console.log(`- Payment Record for ${currentMonthYear}:`, agusPayment ? 'FOUND' : 'NOT FOUND');
        if (agusPayment) {
            console.log(`  Status: ${agusPayment.status}, Amount: Rp ${agusPayment.amount}`);
        }
        
        // Check payment proofs
        console.log('\n=== PAYMENT PROOFS ===\n');
        
        const aninProofs = await db.getPaymentProofsByStatus('pending_approval');
        const aninProof = aninProofs.find(p => p.user_id === anin.id);
        console.log(`ANIN Pending Proofs:`, aninProof ? 'FOUND' : 'NOT FOUND');
        if (aninProof) {
            console.log(`  Proof ID: ${aninProof.id}, Amount: Rp ${aninProof.amount}`);
        }
        
        const agusProofs = await db.getPaymentProofsByStatus('pending_approval');
        const agusProof = agusProofs.find(p => p.user_id === agus.id);
        console.log(`AGUS Pending Proofs:`, agusProof ? 'FOUND' : 'NOT FOUND');
        if (agusProof) {
            console.log(`  Proof ID: ${agusProof.id}, Amount: Rp ${agusProof.amount}`);
        }
        
        // Check all payment proofs for both users
        console.log('\n=== ALL PAYMENT PROOFS FOR BOTH USERS ===\n');
        
        const allProofs = await db.getPaymentProofsByStatus('pending_approval');
        console.log(`Total pending proofs: ${allProofs.length}`);
        
        allProofs.forEach(p => {
            if (p.user_id === anin.id || p.user_id === agus.id) {
                console.log(`- ${p.username} (ID: ${p.id}): Amount: Rp ${p.amount}, Status: ${p.status}`);
            }
        });
        
        db.closeDB();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkPayments();