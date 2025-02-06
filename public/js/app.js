$(document).ready(function(){
  // Function to load server status with filter parameters
  function loadServerStatus() {
    let filterOwner = $("#filterOwner").val() || "";
    let filterApp = $("#filterApp").val() || "";
    let filterServer = $("#filterServer").val() || "";
    let filterSeqMin = $("#filterSeqMin").val() || "";
    let filterSeqMax = $("#filterSeqMax").val() || "";
    let filterStatus = $("#filterStatus").val() || "";
    let filterPingable = $("#filterPingable").val() || "";
    $.ajax({
      url: "/status",
      method: "GET",
      data: { 
        filterOwner, filterApp, filterServer,
        filterSeqMin, filterSeqMax, filterStatus, filterPingable 
      },
      dataType: "json",
      success: function(data) {
        $("#server-status").fadeOut(200, function(){
          $(this).html(data.html).fadeIn(400);
        });
        $(".progress-bar").css("width", data.progress + "%").text(data.progress + "%");
      },
      error: function() {
        console.error("Error fetching server status.");
      }
    });
  }
  
  // Initial load and polling interval (5 minutes)
  loadServerStatus();
  setInterval(loadServerStatus, 300000);
  
  // Filter form submission
  $("#filter-form").on("submit", function(e){
    e.preventDefault();
    loadServerStatus();
  });
  
  // Manual Ping Trigger
  $(document).on("click", "#trigger-ping", function(){
    $.ajax({
      url: "/trigger_ping",
      method: "POST",
      dataType: "json",
      success: function(response) {
        alert(response.message);
        loadServerStatus();
      },
      error: function(xhr) {
        alert("Error: " + xhr.responseJSON.message);
      }
    });
  });
  
  // CSV import form submission
  $("#csv-import-form").on("submit", function(e){
    e.preventDefault();
    var formData = new FormData(this);
    $.ajax({
      url: "/upload",
      type: "POST",
      data: formData,
      processData: false,
      contentType: false,
      dataType: "json",
      success: function(response){
        alert(response.message);
      },
      error: function(xhr){
        alert("Error: " + xhr.responseJSON.message);
      }
    });
  });
  
  // Shutdown button handler
  $(document).on("click", ".shutdown-btn", function(){
    var btn = $(this);
    var owner = btn.data("owner");
    var application = btn.data("application");
    var server = btn.data("server");
    $.ajax({
      url: "/shutdown",
      method: "POST",
      data: { owner: owner, application: application, server: server },
      dataType: "json",
      success: function(response){
        alert(response.message);
        loadServerStatus();
      },
      error: function(xhr){
        alert("Error: " + xhr.responseJSON.message);
      }
    });
  });
  
  // Delete button handler
  $(document).on("click", ".delete-btn", function(){
    if (!confirm("Are you sure you want to delete this record?")) return;
    var btn = $(this);
    var owner = btn.data("owner");
    var application = btn.data("application");
    var server = btn.data("server");
    $.ajax({
      url: "/delete_record",
      method: "POST",
      data: { owner: owner, application: application, server: server },
      dataType: "json",
      success: function(response){
        alert(response.message);
        location.reload();
      },
      error: function(xhr){
        alert("Error: " + xhr.responseJSON.message);
      }
    });
  });
  
  // Admin edit modal handling using Bootstrap's modal
  var editModal = new bootstrap.Modal(document.getElementById('edit-modal'));
  $(document).on("click", ".edit-btn", function(){
    var btn = $(this);
    $("#orig_owner").val(btn.data("orig_owner"));
    $("#orig_app").val(btn.data("orig_app"));
    $("#orig_server").val(btn.data("orig_server"));
    var row = btn.closest("tr");
    $("#new_owner").val(row.find("td[data-field='owner']").text());
    $("#new_app").val(row.find("td[data-field='application']").text());
    $("#new_server").val(row.find("td[data-field='server']").text());
    $("#new_status").val(row.find("td[data-field='status']").text());
    $("#new_shutdown_sequence").val(row.find("td[data-field='shutdown_sequence']").text());
    $("#new_pingable").val(row.find("td[data-field='pingable']").text());
    editModal.show();
  });
  
  $("#edit-form").on("submit", function(e){
    e.preventDefault();
    $.ajax({
      url: "/edit_record",
      method: "POST",
      data: $(this).serialize(),
      dataType: "json",
      success: function(response){
        alert(response.message);
        location.reload();
      },
      error: function(xhr){
        alert("Error: " + xhr.responseJSON.message);
      }
    });
  });
});
