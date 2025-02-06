const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse');
const ping = require('ping');
const cookieParser = require('cookie-parser');
const upload = multer();
const app = express();
const PORT = 3001;

// Use cookie parser middleware for admin login
app.use(cookieParser());

// Simple admin authentication using cookie "adminAuth"
function requireAdminAuth(req, res, next) {
  if (req.cookies && req.cookies.adminAuth === 'secret') {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

// In-memory data store structure:
// { owner: { application: [ { server, status, shutdown_sequence, pingable } ] } }
let dataStore = {};

// In-memory activity log
let activityLog = [];

// Log helper
function logActivity(message) {
  const timestamp = new Date().toLocaleString();
  activityLog.push(`[${timestamp}] ${message}`);
  if (activityLog.length > 100) activityLog.shift();
}

// Load demo data if empty
function loadDemoData() {
  if (Object.keys(dataStore).length > 0) return;
  const owners = ['Owner1','Owner2','Owner3','Owner4','Owner5'];
  const apps = ['App1','App2','App3','App4','App5','App6','App7','App8','App9','App10'];
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
  logActivity("Loaded demo data");
}

// Calculate progress: percentage of servers offline/shutdown
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

// Set view engine and layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sample_csv', express.static(path.join(__dirname, 'sample_csv')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Admin Login Routes
app.get('/admin/login', (req, res) => {
  res.render('admin_login', { title: 'Admin Login', error: null });
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'secret') {
    res.cookie('adminAuth', 'secret', { httpOnly: true });
    logActivity("Admin logged in");
    res.redirect('/admin');
  } else {
    res.render('admin_login', { title: 'Admin Login', error: 'Invalid password' });
  }
});

// Ensure demo data is loaded for every request
app.use((req, res, next) => {
  loadDemoData();
  next();
});

// /status endpoint for Dashboard (returns JSON with HTML)
app.get('/status', (req, res) => {
  // console.log("Owners in dataStore:", Object.keys(dataStore).length);
  // Use default filters if not provided
  const filterOwner = (req.query.filterOwner || "").toLowerCase();
  const filterApp = (req.query.filterApp || "").toLowerCase();
  const filterServer = (req.query.filterServer || "").toLowerCase();
  const filterSeqMin = req.query.filterSeqMin ? Number(req.query.filterSeqMin) : null;
  const filterSeqMax = req.query.filterSeqMax ? Number(req.query.filterSeqMax) : null;
  const filterStatus = (req.query.filterStatus || "all").toLowerCase();
  const filterPingable = (req.query.filterPingable || "all").toLowerCase();
  
  let html = '';
  Object.entries(dataStore).forEach(([owner, apps]) => {
    if (filterOwner && !owner.toLowerCase().includes(filterOwner)) return;
    html += `<div class="owner-section mb-3"><h5>Owner: ${owner}</h5>`;
    Object.entries(apps).forEach(([appName, servers]) => {
      if (filterApp && !appName.toLowerCase().includes(filterApp)) return;
      let filtered = servers.filter(srv => {
        if (filterServer && !srv.server.toLowerCase().includes(filterServer)) return false;
        let seq = Number(srv.shutdown_sequence);
        if (filterSeqMin !== null && seq < filterSeqMin) return false;
        if (filterSeqMax !== null && seq > filterSeqMax) return false;
        if (filterStatus !== "all" && srv.status.toLowerCase() !== filterStatus) return false;
        if (filterPingable !== "all" && srv.pingable.toLowerCase() !== filterPingable) return false;
        return true;
      }).sort((a, b) => Number(a.shutdown_sequence) - Number(b.shutdown_sequence));
      
      // Only show the app if there is at least one server
      if (filtered.length === 0) return;
      
      html += `<div class="app-section card p-2 mb-3">
                 <div class="d-flex justify-content-between align-items-center mb-2">
                   <h6 class="mb-0">Application: ${appName}</h6>
                   <small>${filtered.length} servers</small>
                 </div>`;
      // Group filtered servers by shutdown_sequence
      let groups = {};
      filtered.forEach(srv => {
        if (!groups[srv.shutdown_sequence]) groups[srv.shutdown_sequence] = [];
        groups[srv.shutdown_sequence].push(srv);
      });
      let seqKeys = Object.keys(groups).sort((a, b) => Number(a) - Number(b));
      html += `<div class="server-boxes d-flex flex-wrap">`;
      seqKeys.forEach(seq => {
        html += `<div class="w-100"><strong>Sequence: ${seq}</strong></div>`;
        groups[seq].forEach(srv => {
          let currentSeq = Number(srv.shutdown_sequence);
          let disableShutdown = seqKeys.some(key => {
            if (Number(key) < currentSeq) {
              return groups[key].some(other => other.status !== 'shutdown');
            }
            return false;
          });
          let statusBadge = '';
          if (srv.status === 'online') {
            statusBadge = '<span class="badge bg-success">Online</span>';
          } else if (srv.status === 'offline') {
            statusBadge = '<span class="badge bg-danger">Offline</span>';
          } else {
            statusBadge = `<span class="badge bg-secondary">${srv.status}</span>`;
          }
          html += `
            <div class="card server-box m-1">
              <div class="card-body p-1 text-center">
                <h5 class="card-title" style="font-size: 0.9rem; margin:0;">${srv.server}</h5>
                <p style="margin:0;">${statusBadge}</p>
                <p style="margin:0;"><small>Seq: ${srv.shutdown_sequence}</small></p>
                <div class="d-flex flex-column mt-2">
                  <button class="btn btn-warning btn-sm mb-1 initiate-btn" data-owner="${owner}" data-application="${appName}" data-server="${srv.server}" ${disableShutdown ? 'disabled' : ''}>Initiate Shutdown</button>
                  <button class="btn btn-info btn-sm mb-1 check-btn" data-owner="${owner}" data-application="${appName}" data-server="${srv.server}">Check Status</button>
                  <button class="btn btn-primary btn-sm mb-1 edit-btn" data-orig_owner="${owner}" data-orig_app="${appName}" data-orig_server="${srv.server}">Edit</button>
                </div>
              </div>
            </div>
          `;
        });
      });
      html += `</div></div>`;
    });
    html += `</div>`;
  });
  let overallProgress = calculateProgress();
  res.json({ html, progress: overallProgress });
});

// Dashboard view route
app.get('/', (req, res) => {
  res.render('index', { title: 'Dashboard' });
});

// Applications view
app.get('/applications', (req, res) => {
  res.render('applications', { title: 'Applications', data: dataStore });
});

// Admin view (protected)
app.get('/admin', requireAdminAuth, (req, res) => {
  res.render('admin', { title: 'Admin Panel', data: dataStore, activityLog });
});

// Admin CSV Import tab (protected)
app.get('/admin/csv_import', requireAdminAuth, (req, res) => {
  res.render('csv_import', { title: 'CSV Import' });
});

// KPI view: pass KPI metrics and asset list
app.get('/kpi', (req, res) => {
  const kpi = computeKPI();
  let assets = [];
  Object.keys(dataStore).forEach(owner => {
    Object.keys(dataStore[owner]).forEach(app => {
      dataStore[owner][app].forEach(srv => {
        assets.push({ owner, application: app, ...srv });
      });
    });
  });
  res.render('kpi', { title: 'KPI Dashboard', kpi, assets });
});

// CSV Import endpoint (protected)
app.post('/upload', requireAdminAuth, upload.single('csv_file'), (req, res) => {
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
    logActivity(`Imported ${importedCount} records via CSV`);
    return res.json({ message: `CSV imported successfully. ${importedCount} records added.` });
  });
});

// Trigger Ping Test endpoint
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
    .then(() => {
      logActivity("Ping test triggered on all servers");
      res.json({ message: "Ping test triggered and statuses updated." });
    })
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
  if (updated) {
    logActivity(`Initiated shutdown for ${server}`);
    return res.json({ message: `Shutdown sequence initiated for ${server}.` });
  } else {
    return res.status(404).json({ message: 'Server not found or already shut down.' });
  }
});

// Shutdown endpoint
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
  if (updated) {
    logActivity(`Server ${server} shut down`);
    return res.json({ message: `Server '${server}' has been shut down.` });
  } else {
    return res.status(404).json({ message: 'Server not found or already shut down.' });
  }
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
      logActivity(`Edited record for ${orig_server}`);
    }
  }
  if (updated) return res.json({ message: 'Record updated successfully.' });
  else return res.status(404).json({ message: 'Record not found.' });
});

// DELETE record endpoint
app.post('/delete_record', (req, res) => {
  const { owner, application, server } = req.body;
  if (dataStore[owner] && dataStore[owner][application]) {
    const index = dataStore[owner][application].findIndex(srv => srv.server === server);
    if (index > -1) {
      dataStore[owner][application].splice(index, 1);
      logActivity(`Deleted record for ${server}`);
      return res.json({ message: 'Record deleted successfully.' });
    }
  }
  return res.status(404).json({ message: 'Record not found.' });
});

app.post('/check_status', (req, res) => {
  const { owner, application, server } = req.body;
  if (dataStore[owner] && dataStore[owner][application]) {
    const foundServer = dataStore[owner][application].find(srv => srv.server === server);
    if (foundServer) {
      return res.json({ message: `Server '${server}' is currently ${foundServer.status}.` });
    }
  }
  return res.status(404).json({ message: 'Server not found.' });
});

// 404 catch-all handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
