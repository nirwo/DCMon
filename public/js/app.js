$(document).ready(function () {
  // Function to load server status with filter parameters
  function loadServerStatus() {
    const filterOwner = $("#filterOwner").val() || "";
    const filterApp = $("#filterApp").val() || "";
    const filterServer = $("#filterServer").val() || "";
    const filterSeqMin = $("#filterSeqMin").val() || "";
    const filterSeqMax = $("#filterSeqMax").val() || "";
    const filterStatus = $("#filterStatus").val() || "";
    const filterPingable = $("#filterPingable").val() || "";

    $.ajax({
      url: "/status",
      method: "GET",
      data: {
        filterOwner,
        filterApp,
        filterServer,
        filterSeqMin,
        filterSeqMax,
        filterStatus,
        filterPingable
      },
      dataType: "json",
      success: function (data) {
        // alert(JSON.stringify(data)); // <-- comment or remove
        $("#server-status").fadeOut(200, function () {
          $(this).html(data.html).fadeIn(400);
        });
        const progressVal = data.progress || 0;
        $("#progress .progress-bar")
          .css("width", progressVal + "%")
          .text(progressVal + "%");
      },
      error: function (xhr, status, error) {
        console.error("Error fetching server status:", error);
      }
    });
  }

  // Initial load and polling interval (5 minutes)
  loadServerStatus();
  setInterval(loadServerStatus, 300000);

  // Filter form submission
  $("#filter-form").on("submit", function (e) {
    e.preventDefault();
    loadServerStatus();
  });

  // Manual Ping Trigger
  $(document).on("click", "#trigger-ping", function () {
    $.ajax({
      url: "/trigger_ping",
      method: "POST",
      dataType: "json",
      success: function (response) {
        // alert(response.message); // <-- comment or remove
        loadServerStatus();
      },
      error: function (xhr) {
        alert("Error: " + (xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "Unknown error"));
      }
    });
  });

  // Initiate Shutdown button handler
  $(document).on("click", ".initiate-btn", function () {
    const owner = $(this).data("owner");
    const application = $(this).data("application");
    const server = $(this).data("server");
    $.ajax({
      url: "/initiate_shutdown",
      method: "POST",
      data: { owner, application, server },
      dataType: "json",
      success: function (response) {
        // alert(response.message); // <-- comment or remove
        loadServerStatus();
      },
      error: function (xhr) {
        alert("Error: " + (xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "Unknown error"));
      }
    });
  });

  // Check Status button handler
  $(document).on("click", ".check-btn", function () {
    const owner = $(this).data("owner");
    const application = $(this).data("application");
    const server = $(this).data("server");
    $.ajax({
      url: "/check_status",
      method: "POST",
      data: { owner, application, server },
      dataType: "json",
      success: function (response) {
        // alert(response.message); // <-- comment or remove
        loadServerStatus();
      },
      error: function (xhr) {
        alert("Error: " + (xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "Unknown error"));
      }
    });
  });

  // Edit button handler: open edit modal and populate fields
  $(document).on("click", ".edit-btn", function () {
    const owner = $(this).data("orig_owner");
    const application = $(this).data("orig_app");
    const server = $(this).data("orig_server");

    // Populate modal fields (assuming your modal inputs have these IDs)
    $("#orig_owner").val(owner);
    $("#orig_app").val(application);
    $("#orig_server").val(server);
    $("#new_owner").val(owner);
    $("#new_app").val(application);
    $("#new_server").val(server);

    // Open modal (assumes a Bootstrap modal with id "edit-modal" exists)
    const modalElement = document.getElementById("edit-modal");
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    } else {
      console.error("Edit modal element not found.");
    }
  });

  // Edit form submission
  $("#edit-form").on("submit", function (e) {
    e.preventDefault();
    $.ajax({
      url: "/edit_record",
      method: "POST",
      data: $(this).serialize(),
      dataType: "json",
      success: function (response) {
        // alert(response.message); // <-- comment or remove
        loadServerStatus();
      },
      error: function (xhr) {
        alert("Error: " + (xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "Unknown error"));
      }
    });
  });
});
