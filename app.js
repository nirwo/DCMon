const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse');
const ping = require('ping');
const upload = multer();
const app = express();
const PORT = 3000;

// Simple admin authentication middleware (example: header "x-admin-password" must equal "secret")
function requireAdminAuth(req, res, next) {
  const pwd = req.headers['x-admin-password'];
  if (pwd === 'secret') {
    next();
  } else {
    res.status(401).send("Unauthorized: Invalid admin password.");
  }
}

// Set view engine and default layout
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sample_csv', express.static(path.join(__dirname, 'sample_csv')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// In-memory data store structure: 
// { owner: { application: [ { server, status, shutdown_sequence, pingable } ] } }
let dataStore = {};

// Load demo data if dataStore is empty
function loadDemoData() {
  if (Object.keys(dataStore).length > 0) return;
  const owners = ['Owner1', 'Owner2', 'Owner3', 'Owner4', 'Owner5'];
  const apps = ['App1', 'App2', 'App3', 'App4', 'App5', 'App6', 'App7', 'App8', 'App9', 'App10'];
  for (let i = 1; i <= 200; i++) {
    const owner = owners[Math.floor(Math.random() * owners.length)];
    const application = apps[Math.floor(Math.random() * apps.length)];
    const server = 'server' + i;
    const status = (Math.random() > 0.5) ? 'online' : 'offline';
    const pingable = (status === 'online' && Math.random() > 0.2) ? 'yes' : 'no';
    const shutdown_sequence = (Math.floor(Math.random() * 5)).toString();
    if (!dataStore[owner]) dataStore[owner] = {};
    if (!dataStore[owner][application]) dataStore[owner][application] = [];
    dataStore[owner][application].push({ server, status, shutdown_sequence, pingable });
  }
}

// Calculate overall progress (percentage of servers offline/shutdown)
function calculateProgress() {
  let total = 0, down = 0;
  Object.values(dataStore).forEach(apps => {
    Object.values(apps).forEach(servers => {
      servers.forEach(srv => {
        total++;
        if (srv.status === 'offline' || srv.status === 'shutdown') {
          down++;
        }
      });
    });
  });
  return total > 0 ? Math.round((down / total) * 100) : 0;
}

// Compute KPI metrics
function computeKPI() {
  let total_servers = 0, online = 0, offline = 0, pingable = 0, non_pingable = 0;
  const applications = new Set();
  Object.entries(dataStore).forEach(([owner, apps]) => {
    Object.entries(apps).forEach(([appName, servers]) => {
      applications.add(owner + '|' + appName);
      servers.forEach(srv => {
        total_servers++;
        if (srv.status === 'online') online++;
        else if (srv.status === 'offline' || srv.status === 'shutdown') offline++;
        if (srv.pingable === 'yes') pingable++;
        else non_pingable++;
      });
    });
  });
  return { total_servers, total_applications: applications.size, online, offline, pingable, non_pingable };
}

// Ensure demo data is loaded
app.use((req, res, next) => {
  loadDemoData();
  next();
});

// Extended filtering in /status endpoint.
// This endpoint produces server cards as small, flexible boxes without fixed width.
app.get('/status', (req, res) => {
  const filterOwner = (req.query.filterOwner || "").toLowerCase();
  const filterApp = (req.query.filterApp || "").toLowerCase();
  const filterServer = (req.query.filterServer || "").toLowerCase();
  const filterSeqMin = req.query.filterSeqMin ? Number(req.query.filterSeqMin) : null;
  const filterSeqMax = req.query.filterSeqMax ? Number(req.query.filterSeqMax) : null;
  const filterStatus = (req.query.filterStatus || "").toLowerCase();
  const filterPingable = (req.query.filterPingable || "").toLowerCase();
  
  let html = '';
  Object.entries(dataStore).forEach(([owner, apps]) => {
    if (filterOwner && !owner.toLowerCase().includes(filterOwner)) return;
    html += `<div class="owner-section mb-2"><h5>Owner: ${owner}</h5>`;
    Object.entries(apps).forEach(([appName, servers]) => {
      if (filterApp && !appName.toLowerCase().includes(filterApp)) return;
      html += `<div class="app-section card p-2 mb-2">
                 <div class="d-flex justify-content-between align-items-center mb-2">
                   <h6 class="mb-0">Application: ${appName}</h6>
                   <small>${servers.length} servers</small>
                 </div>
                 <div class="server-boxes d-flex flex-wrap">`;
      servers
        .filter(srv => {
          if (filterServer && !srv.server.toLowerCase().includes(filterServer)) return false;
          let seq = Number(srv.shutdown_sequence);
          if (filterSeqMin !== null && seq < filterSeqMin) return false;
          if (filterSeqMax !== null && seq > filterSeqMax) return false;
          if (filterStatus && filterStatus !== "all" && srv.status.toLowerCase() !== filterStatus) return false;
          if (filterPingable && filterPingable !== "all" && srv.pingable.toLowerCase() !== filterPingable) return false;
          return true;
        })
        .sort((a, b) => Number(a.shutdown_sequence) - Number(b.shutdown_sequence))
        .forEach(srv => {
          let statusIcon = (srv.status === 'online') 
            ? '<span class="dot dot-green"></span>' 
            : '<span class="dot dot-red"></span>';
          html += `
            <div class="card server-box m-2">
              <div class="card-body p-1 text-center">
                <h6 class="card-title" style="font-size: 0.7rem; margin-bottom: 3px;">${srv.server}</h6>
                <div class="mb-1">${statusIcon}</div>
                <div class="btn-group btn-group-sm" role="group">
                  <button class="btn btn-warning initiate-btn" data-owner="${owner}" data-application="${appName}" data-server="${srv.server}">Shutdown</button>
                  <button class="btn btn-info check-btn" data-owner="${owner}" data-application="${appName}" data-server="${srv.server}">Stat</button>
                  <button class="btn btn-primary edit-btn" data-orig_owner="${owner}" data-orig_app="${appName}" data-orig_server="${srv.server}">Edit</button>
                  <button class="btn btn-danger delete-btn" data-owner="${owner}" data-application="${appName}" data-server="${srv.server}">Del</button>
                </div>
              </div>
            </div>
          `;
        });
      html += `</div></div>`;
    });
    html += `</div>`;
  });
  const overallProgress = calculateProgress();
  res.json({ html, progress: overallProgress });
});

// New endpoint: Check status for an individual server (using ping)
app.post('/check_status', (req, res) => {
  const { owner, application, server } = req.body;
  if (dataStore[owner] && dataStore[owner][application]) {
    const srv = dataStore[owner][application].find(s => s.server === server);
    if (srv) {
      ping.promise.probe(srv.server)
        .then(result => {
          srv.status = result.alive ? 'online' : 'offline';
          return res.json({ message: `Status for ${server} updated to ${srv.status}.` });
        })
        .catch(() => res.status(500).json({ message: 'Error checking status.' }));
    } else {
      res.status(404).json({ message: 'Server not found.' });
    }
  } else {
    res.status(404).json({ message: 'Record not found.' });
  }
});

// Dashboard view
app.get('/', (req, res) => {
  res.render('index', { title: 'Dashboard' });
});

// Applications view
app.get('/applications', (req, res) => {
  res.render('applications', { title: 'Applications', data: dataStore });
});

// Admin view (protected)
app.get('/admin', requireAdminAuth, (req, res) => {
  res.render('admin', { title: 'Admin Panel', data: dataStore });
});

// Admin CSV Import tab (protected)
app.get('/admin/csv_import', requireAdminAuth, (req, res) => {
  res.render('csv_import', { title: 'CSV Import' });
});

// KPI view
app.get('/kpi', (req, res) => {
  const kpi = computeKPI();
  res.render('kpi', { title: 'KPI Dashboard', kpi });
});

// CSV Import endpoint: clear existing data then import CSV
app.post('/upload', upload.single('csv_file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
  dataStore = {};
  const map_owner = req.body.map_owner || 'owner';
  const map_application = req.body.map_application || 'application';
  const map_server = req.body.map_server || 'server';
  const map_status = req.body.map_status || 'status';
  const map_shutdown_sequence = req.body.map_shutdown_sequence || 'shutdown_sequence';
  const map_pingable = req.body.map_pingable || 'pingable';
  const csvData = req.file.buffer.toString('utf8');
  let importedCount = 0;
  parse(csvData, { columns: true, trim: true }, (err, records) => {
    if (err) return res.status(400).json({ message: 'Error parsing CSV.' });
    records.forEach(row => {
      const owner = row[map_owner] || 'Unknown';
      const application = row[map_application] || 'Unknown';
      const server = row[map_server] || '';
      const status = row[map_status] || 'online';
      const shutdown_sequence = row[map_shutdown_sequence] || '0';
      const pingable = row[map_pingable] || 'yes';
      if (!server) return;
      if (!dataStore[owner]) dataStore[owner] = {};
      if (!dataStore[owner][application]) dataStore[owner][application] = [];
      dataStore[owner][application].push({ server, status, shutdown_sequence, pingable });
      importedCount++;
    });
    return res.json({ message: `CSV imported successfully. ${importedCount} records added.` });
  });
});

// Trigger Ping Test endpoint: update status of each server by pinging
app.post('/trigger_ping', async (req, res) => {
  let promises = [];
  Object.keys(dataStore).forEach(owner => {
    Object.keys(dataStore[owner]).forEach(appName => {
      dataStore[owner][appName].forEach(srv => {
        let host = srv.server;
        let p = ping.promise.probe(host).then(result => {
          srv.status = result.alive ? 'online' : 'offline';
        }).catch(() => { srv.status = 'offline'; });
        promises.push(p);
      });
    });
  });
  Promise.all(promises)
    .then(() => res.json({ message: "Ping test triggered and statuses updated." }))
    .catch(() => res.status(500).json({ message: "Error during ping tests." }));
});

// Initiate Shutdown Sequence endpoint (alias for shutdown)
app.post('/initiate_shutdown', (req, res) => {
  const { owner, application, server } = req.body;
  let updated = false;
  if (dataStore[owner] && dataStore[owner][application]) {
    dataStore[owner][application].forEach(srv => {
      if (srv.server === server && srv.status !== 'offline' && srv.status !== 'shutdown') {
        srv.status = 'shutdown';
        updated = true;
      }
    });
  }
  if (updated) return res.json({ message: `Shutdown sequence initiated for ${server}.` });
  else return res.status(404).json({ message: 'Server not found or already shut down.' });
});

// Shutdown endpoint: mark server as shutdown
app.post('/shutdown', (req, res) => {
  const { owner, application, server } = req.body;
  let updated = false;
  if (dataStore[owner] && dataStore[owner][application]) {
    dataStore[owner][application].forEach(srv => {
      if (srv.server === server && srv.status !== 'offline' && srv.status !== 'shutdown') {
        srv.status = 'shutdown';
        updated = true;
      }
    });
  }
  if (updated) return res.json({ message: `Server '${server}' has been shut down.` });
  else return res.status(404).json({ message: 'Server not found or already shut down.' });
});

// Admin edit record endpoint
app.post('/edit_record', (req, res) => {
  const { orig_owner, orig_app, orig_server, new_owner, new_app, new_server, new_status, new_shutdown_sequence, new_pingable } = req.body;
  let updated = false;
  if (dataStore[orig_owner] && dataStore[orig_owner][orig_app]) {
    const index = dataStore[orig_owner][orig_app].findIndex(srv => srv.server === orig_server);
    if (index > -1) {
      let record = dataStore[orig_owner][orig_app].splice(index, 1)[0];
      record = Object.assign(record, {
        server: new_server,
        status: new_status,
        shutdown_sequence: new_shutdown_sequence,
        pingable: new_pingable
      });
      if (!dataStore[new_owner]) dataStore[new_owner] = {};
      if (!dataStore[new_owner][new_app]) dataStore[new_owner][new_app] = [];
      dataStore[new_owner][new_app].push(record);
      updated = true;
    }
  }
  if (updated) return res.json({ message: 'Record updated successfully.' });
  else return res.status(404).json({ message: 'Record not found.' });
});

// DELETE record endpoint: delete a record by owner, application, and server
app.post('/delete_record', (req, res) => {
  const { owner, application, server } = req.body;
  if (dataStore[owner] && dataStore[owner][application]) {
    const index = dataStore[owner][application].findIndex(srv => srv.server === server);
    if (index > -1) {
      dataStore[owner][application].splice(index, 1);
      return res.json({ message: 'Record deleted successfully.' });
    }
  }
  return res.status(404).json({ message: 'Record not found.' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
