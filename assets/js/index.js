$(document).ready(function() {
    var startButtonGroup = "<div class='btn-group' role='group' aria-label='Book actions'>";
    var infoButton = "<button type='button' title='Info' aria-label='Show book information' class='book_info btn btn-outline-dark'>&#8505;</button>";
    var playButton = "<button type='button' title='Play' aria-label='Play book' class='play_book btn btn-outline-dark'>&#9654;</button>";
    var endButtonGroup = '</div>';
    var t = $('#books').DataTable({
        'ajax': 'catalog/catalog.json',
        'deferRender': true,
        'scrollY': 'calc(100vh - 195px)',
        'scroller': true,
        'responsive': true,
        'columns': [
            {
                'title': 'Title',
                'responsivePriority': 1,
                'render': $.fn.dataTable.render.ellipsis(40)
            },
            {
                'title': 'Author',
                'responsivePriority': 2,
                'render': $.fn.dataTable.render.ellipsis(30)
            },
            {
                'title': 'Minutes',
                'responsivePriority': 5
            },
            {
                'title': 'Genres',
                'responsivePriority': 3,
                'render': $.fn.dataTable.render.ellipsis(25)
            },
            {
                'title': 'Language',
                'responsivePriority': 4
            },
            {
                'title': 'Year',
                'responsivePriority': 6
            },
            {
                'title': 'Actions',
                'responsivePriority': 7,
                'render': function(bookPath) {
                    return "<input type='hidden' class='book_path' value='" + bookPath + "'>"
                         + startButtonGroup
                         + infoButton
                         + playButton
                         + getButtonForBookOfflineAvailablity(bookPath)
                         + endButtonGroup;
                }
            }
        ]
    });

  $(document).on('click', ".book_info", function (ev) {
    $('.book-info-modal-description').html('<img src="assets/img/loading.svg">');
    $('.book-info-modal-title').text('Loading...');
    $('.book-info-modal-cover-art').css('display', 'none');
    $('.book-info-modal-supporters').html('');
    var path = $(ev.target).closest('td').find(".book_path").val();
    $.get("./catalog/books/" + path + "/index.json")
    .done(function(data) {
        if (typeof data === 'string') data = JSON.parse(data);
        $('.book-info-modal-title').text(data.title);
        $('.book-info-modal-description').html(data.description);
        var coverArtPath = './catalog/books/' + path + '/cover.jpg';
        $('.book-info-modal-cover-art').attr('src', coverArtPath).css('display', '');
        data.supporters.forEach(function (supporter) {
            var supporterListItem = $('<li>')
                .append($('<span>').text(supporter.role + " "))
                .append($('<i>').text(supporter.name));
            $('.book-info-modal-supporters').append(supporterListItem);
        });
    })
    .fail(function(data) {
        $('.book-info-modal-description').html('Book information failed to load.');
    });
    $('#book-info-modal').modal('show');
  });

  $(document).on('click', '.play_book', function (ev) {
    var path = $(ev.target).closest('td').find(".book_path").val();
    $.get("./catalog/books/" + path + "/index.json")
    .done(function(data) {
        if (typeof data === 'string') data = JSON.parse(data);
        APlayerObject.list.clear();
        var authors = data.authors.map(function (author) { return author.name; }).join(', ');
        var baseUrl = "./catalog/books/" + path + "/";
        data.sections.forEach(function (section) {
            APlayerObject.list.add({
                name: section.title,
                artist: authors,
                url: baseUrl + section.path,
                cover: baseUrl + "cover.jpg"
            });
        });

        // Jump to player
        var url = location.href;
        location.href = "#listen";
        history.replaceState(null,null,url);

        APlayerObject.play();
    });
  });

  $(document).on('click', '.download_book', function (ev) {
    var store = window.localStorage;
    var book = $(ev.target).closest('td').find(".book_path").val();
    var queued = store.getItem('offlineQueued');
    queued = JSON.parse(queued);
    queued.push(book);
    store.setItem('offlineQueued', JSON.stringify(queued));
    startDownload(book);
    t.row($(ev.target).closest('tr')).invalidate().draw('page');
  });

  var APlayerObject = new APlayer({
    element: document.getElementById('audioplayer'),
    mini: false,
    autoplay: false,
    lrcType: false,
    mutex: true,
    preload: 'auto',
    volume: 1.0,
    loop: 'none',
    listMaxHeight: 1500,
    audio: []
  });

  setTimeout(function() { $('div.dataTables_filter input').focus(); }, 0);

  function getButtonForBookOfflineAvailablity(book) {
    var store = window.localStorage;
    if (!store) {
        alert("This browser doesn't support localStorage and won't support offline books. Let the developer know that you would like this resolved.");
    }
    var queued = store.getItem('offlineQueued');
    var downloaded = store.getItem('offlineDownloaded');
    if (downloaded.includes(book)) {
        return "<button type='button' title='Book is available offline' aria-label='Book is available offline' class='downloaded_book btn btn-outline-dark' disabled>Available Offline</button>";
    }
    if (queued.includes(book)) {
        return "<button type='button' title='Downloading book' aria-label='Downloading book' class='downloading_book btn btn-outline-dark' disabled>Downloading...</button>";
    }
    return "<button type='button' title='Download for offline use' aria-label='Download for offline use' class='download_book btn btn-outline-dark'>Store Offline</button>";
  }

  var toDownload = [];

  function startDownload(bookPath) {
    $.get("./catalog/books/" + bookPath + "/index.json")
    .done(function(data) {
      if (typeof data === 'string') data = JSON.parse(data);
      var baseUrl = "./catalog/books/" + bookPath + "/";
      data.sections.forEach(function (section) {
        toDownload.push(baseUrl + section.path);
      });
    })
    .fail(function(){
        alert("Failed to download index for downloading book");
    });
  }

  function downloadNextToDownload() {
    if (toDownload.length == 0) {
        setTimeout(downloadNextToDownload, 3000);
        var store = window.localStorage;
        if (!store) {
          alert("This browser doesn't support localStorage and won't support offline books. Let the developer know that you would like this resolved.");
        }
        var queued = store.getItem('offlineQueued');
        queued = JSON.parse(queued);
        var downloaded = store.getItem('offlineDownloaded');
        downloaded = JSON.parse(downloaded);
        while (queued.length > 0) {
          var book = queued.pop();
          downloaded.push(book);
        }
        store.setItem('offlineQueued', JSON.stringify(queued));
        store.setItem('offlineDownloaded', JSON.stringify(downloaded));
        $('#books').find('tr').each(function() {
            t.row(this).invalidate().draw('page');
        });
    }
    else {
      var url = toDownload.pop();
      $.get(url).done(function() {
        downloadNextToDownload();
      })
      .fail(function() {
        toDownload.push(url);
        setTimeout(downloadNextToDownload, 3000);
      });
    }
  }

  function startAllQueuedDownloads() {
    var store = window.localStorage;
    if (!store) {
      alert("This browser doesn't support localStorage and won't support offline books. Let the developer know that you would like this resolved.");
      return;
    }
    var queued = store.getItem('offlineQueued');
    var downloaded = store.getItem('offlineDownloaded');
    if (!queued) {
        store.setItem('offlineQueued', '[]');
        queued = '[]';
    }
    if (!downloaded) {
        store.setItem('offlineDownloaded', '[]');
        downloaded = '[]';
    }
    queued = JSON.parse(queued);
    queued.forEach(function(bookPath){
      startDownload(bookPath);
    });
  }

  startAllQueuedDownloads();
  setTimeout(downloadNextToDownload, 5000);

} );
