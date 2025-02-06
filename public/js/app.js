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
  
  // Initiate Shutdown button handler
  $(document).on("click", ".initiate-btn", function(){
    let owner = $(this).data("owner");
    let application = $(this).data("application");
    let server = $(this).data("server");
    $.ajax({
      url: "/initiate_shutdown",
      method: "POST",
      data: { owner, application, server },
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
  
  // Check Status button handler
  $(document).on("click", ".check-btn", function(){
    let owner = $(this).data("owner");
    let application = $(this).data("application");
    let server = $(this).data("server");
    $.ajax({
      url: "/check_status",
      method: "POST",
      data: { owner, application, server },
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
  
  // Edit button handler: open edit modal and populate fields
  $(document).on("click", ".edit-btn", function(){
    let owner = $(this).data("orig_owner");
    let application = $(this).data("orig_app");
    let server = $(this).data("orig_server");
    // Populate modal fields (for simplicity, only using these basic values)
    $("#orig_owner").val(owner);
    $("#orig_app").val(application);
    $("#orig_server").val(server);
    $("#new_owner").val(owner);
    $("#new_app").val(application);
    $("#new_server").val(server);
    // Open modal (assumes you have a Bootstrap modal with id "edit-modal")
    let modal = new bootstrap.Modal(document.getElementById("edit-modal"));
    modal.show();
  });
  
  // Edit form submission
  $("#edit-form").on("submit", function(e){
    e.preventDefault();
    $.ajax({
      url: "/edit_record",
      method: "POST",
      data: $(this).serialize(),
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
});
