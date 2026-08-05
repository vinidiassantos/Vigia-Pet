// pet-data-model.js
// Modelo de dados do pet

const PetData = {
    petId: "string",
    name: "string",
    breed: "string",
    ownerId: "string",
    createdAt: "timestamp",
    behaviors: {
        sleeping: {
            startTime: "timestamp",
            endTime: "timestamp",
            totalTime: "number" // em minutos
        },
        eating: {
            startTime: "timestamp",
            endTime: "timestamp",
            totalTime: "number"
        },
        active: {
            startTime: "timestamp",
            endTime: "timestamp",
            totalTime: "number"
        }
    },
    dailyStats: {
        date: "timestamp",
        sleepMinutes: "number",
        eatMinutes: "number",
        activeMinutes: "number"
    },
    alerts: [
        {
            timestamp: "timestamp",
            type: "string",
            message: "string",
            read: "boolean"
        }
    ]
};

// Função para salvar comportamento
async function saveBehavior(petId, behavior, timestamp) {
    const docRef = doc(db, "pets", petId, "behaviors", behavior);
    await setDoc(docRef, {
        timestamp: timestamp,
        behavior: behavior
    });
}

// Função para gerar relatório diário
async function generateDailyReport(petId, date) {
    const dailyRef = doc(db, "pets", petId, "dailyStats", date);
    const docSnap = await getDoc(dailyRef);
    
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        return {
            date: date,
            sleepMinutes: 0,
            eatMinutes: 0,
            activeMinutes: 0
        };
    }
}