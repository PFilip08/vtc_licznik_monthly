import axios from 'axios';
import 'dotenv/config'
import * as readline from "node:readline";

const api = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-access-token': process.env.API_TOKEN,
        "User-Agent": 'kalkulator-vtc',
    },
    baseURL: process.env.API_URL,
});

let companyid = 27165;

async function getCompanyId() {
    const id = await new Promise((resolve, reject) => {
        const h = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        h.question('Dej id firmy [27165]: ', id => {
            resolve(id);
            h.close();
        });
    });
    if (id) {companyid = id;}
    const company = await getCompanyData(companyid);
    console.log('Pobieram dane firmy...');
    console.log('Firma: ' + company.name);
    console.log('Właściciel: ' + company.owner.name);
}

async function getCompanyData(id) {
    const company = await api.get('/company/'+id);
    return company.data;
}

// async function getAllMembers() {
//     const members = await api.get('/company/'+companyid+'/members');
//     return members.data;
// }

let dateFrom, dateTo;
async function getMonth() {
    const month = await new Promise((resolve, reject) => {
        const h = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        h.question('Dej miesiąc i rok (yyyy-mm) [obecna -1]: ', month => {
            resolve(month);
            h.close();
        });
    });
    if (!month) {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        let month = date.getMonth() + 1;
        if (month < 10) {
            month = '0' + month;
        }
        dateFrom = date.getFullYear() + '-' + month + '-01';
        dateTo = date.getFullYear() + '-' + month + '-31';
        console.log('Pobieram dane z ' + dateFrom + ' do ' + dateTo);
        return;
    }
    dateFrom = month + '-01';
    dateTo = month + '-31';
    console.log('Pobieram dane z ' + dateFrom + ' do ' + dateTo);

}

async function getAllJobs() {
    const jobs = await api.get('/company/'+companyid+`/jobs?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    const data = jobs.data;

    // get rest of the pages
    if (data.last_page > 1) {
        for (let i = 2; i <= data.last_page; i++) {
            const jobs = await api.get('/company/'+companyid+'/jobs?dateFrom=2025-01-01&dateTo=2025-01-31&page='+i);
            data.data = data.data.concat(jobs.data.data);
        }
    }
    return data.data;
}

async function countPlayerJobs() {
    let jobs = await getAllJobs();
    jobs = jobs.filter(job => job.status === 'completed');
    let players = {};
    jobs.forEach(job => {
        if (players[job.driver.name]) {
            players[job.driver.name]++;
        } else {
            players[job.driver.name] = 1;
        }
    });
    return players;
}

async function playerStats() {
    let jobs = await getAllJobs();
    //only completed and canceled
    jobs = jobs.filter(job => job.status === 'completed');
    let players = {};
    jobs.forEach(job => {
        if (players[job.driver.name]) {
            players[job.driver.name].revenue += job.revenue;
            players[job.driver.name].distance += job.driven_distance_km;
            players[job.driver.name].cargo_mass += job.cargo_mass_t;
            players[job.driver.name].fuel_used += job.fuel_used_l;
        } else {
            players[job.driver.name] = {
                revenue: job.revenue,
                distance: job.driven_distance_km,
                cargo_mass: job.cargo_mass_t,
                fuel_used: job.fuel_used_l,
                name: job.driver.name,
            };
        }
    });
    for (const player in players) {
        players[player].income_distance = Math.round((players[player].revenue / players[player].distance) * 100) / 100;
        players[player].distance_fuel = players[player].fuel_used / players[player].distance * 100;
        players[player].distance_fuel = Number((Math.round(players[player].distance_fuel * 1000) / 1000).toFixed(2));

    }
    return players;
}

async function leaderboards() {
    const stats = await playerStats();
    let distance = [];
    let cargo_mass = [];
    let income = [];
    let economy = [];
    let income_km = [];
    for (const player in stats) {

        distance.push({ name: player, value: Math.round(stats[player].distance) / 1000 });
        cargo_mass.push({ name: player, value: stats[player].cargo_mass });
        income.push({ name: player, value: Math.round(stats[player].revenue) / 1000 });
        economy.push({ name: player, value: stats[player].distance_fuel });
        income_km.push({ name: player, value: stats[player].income_distance });
    }
    distance.sort((a, b) => b.value - a.value);
    cargo_mass.sort((a, b) => b.value - a.value);
    income.sort((a, b) => b.value - a.value);
    economy.sort((a, b) => b.value - a.value);
    income_km.sort((a, b) => b.value - a.value);
    return {
        distance: distance.slice(0, 3),
        cargo_mass: cargo_mass
            .sort((a, b) => b.value - a.value)
            .slice(0, 3),
        income: income
            .sort((a, b) => b.value - a.value)
            .slice(0, 3),
        economy: economy
            .sort((a, b) => a.value - b.value)
            .slice(0, 3),
        income_km: income_km
            .sort((a, b) => b.value - a.value)
            .slice(0, 3),
    };
}

// ask user if data is correct
async function confirmData() {
    const confirm = await new Promise((resolve, reject) => {
        const h = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        h.question('Czy dane są poprawne? [T/n]: ', confirm => {
            resolve(confirm);
            h.close();
        });
    });
    if (confirm === 'y' || confirm === 't' || confirm === '') {
        return;
    }
    await getCompanyId();
    await getMonth();
    await confirmData();
}

await getCompanyId();
await getMonth();
await confirmData();

console.log(await leaderboards());
console.log(await countPlayerJobs());

// console.log(await getCompanyData(companyid));
// console.log(await playerStats());
// console.log(await countPlayerJobs());
// console.log(await getAllJobs());