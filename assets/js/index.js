$(document).ready(function() {
    var availableOfflineText = 'Available Offline';
    var startButtonGroup = "<div class='btn-group' role='group' aria-label='Book actions'>";
    var infoButton = "<button type='button' title='Info' aria-label='Show book information' class='book_info btn btn-outline-dark'>&#8505;</button>";
    var playButton = "<button type='button' title='Play' aria-label='Play book' class='play_book btn btn-outline-dark'>&#9654;</button>";
    var shareButton = "<button type='button' title='Share' aria-label='Share book' class='share_book btn btn-outline-dark'>Share</button>";
    var endButtonGroup = '</div>';
    var switchChapters = null;
    var seekTime = null;

    var t = $('#books').DataTable({
        'ajax': {
          'url': 'catalog/catalog.json',
          'cache': true
        },
        'deferRender': true,
        'scrollY': 'calc(100vh - 195px)',
        'scroller': true,
        'responsive': true,
        'processing': true,
        'oLanguage': {
          'sProcessing': '<div style="top: 0"><img src="assets/img/loading.svg"></div>',
        },
        'search': {
          'search': availableOfflineText
        },
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
                    return "<span class='book_path d-none'>" + bookPath + "</span>"
                         + startButtonGroup
                         + infoButton
                         + playButton
                         + shareButton
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
    var path = $(ev.target).closest('td').find(".book_path").text();
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
    .fail(function(jqxhr, statusText, errorThrown) {
        $('.book-info-modal-description').html('Book information failed to load. Check your connection, and consider making the book available offline when you are connected.');
    });
    $('#book-info-modal').modal('show');
    window.location.hash = "#" + t.search() + "/popup";
  });

  $(document).on('click', '.play_book', function (ev) {
    var path = $(ev.target).closest('td').find(".book_path").text();
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
                cover: baseUrl + "cover.jpg",
                album: data.title
            });
        });

        // Jump to player
        location.href = "#listen";

        APlayerObject.play();

        // For loading the last played part of tracks
        location.href = "#" + path;
        var progress = window.localStorage.getItem('progress');
        if (!progress) progress = '{}';
        progress = JSON.parse(progress);
        var audio = APlayerObject.list.audios[APlayerObject.list.index];
        progress = progress[audio.artist + "|" + audio.album];
        switchChapters = progress['chapter'];
        seekTime = progress['seek'];
    })
    .fail(function(jqXHR, textStatus, errorThrown){
        alert("Failed to play book. Check your internet connection, and consider making the book available offline when you are connected.");
    });
  });

  $(document).on('click', '.download_book', function (ev) {
    var store = window.localStorage;
    var book = $(ev.target).closest('td').find(".book_path").text();
    var queued = store.getItem('offlineQueued');
    queued = JSON.parse(queued);
    queued.push(book);
    store.setItem('offlineQueued', JSON.stringify(queued));
    startDownload(book);
    t.row($(ev.target).closest('tr')).invalidate().draw('page');
  });

  $(document).on('click', '.share_book', function (ev) {
    var book = $(ev.target).closest('td').find(".book_path").text();
    var url = window.location.href.split('#')[0]+"#"+book;
    if (navigator.share) {
      var title = t.row(this).data()[0];
      navigator.share({
        title: title,
	url: url
      });
    }
    else {
      // Copy to clipboard
      var $temp = $("<input>");
      $("body").append($temp);
      $temp.val(url).select();
      document.execCommand("copy");
      $temp.remove();
      ev.target.innerHTML = "Link Copied";
    }
  });

  window.onhashchange = function() {
    var hash = location.hash.substring(1);
    var isPopup = ('/popup' === hash.substring(hash.length - 6));
    if (!isPopup) {
      $('#book-info-modal').modal('hide');
    }
    else {
      hash = hash.substring(0, hash.length - 6);
    }
    if (['look', 'listen', 'learn'].indexOf(hash) === -1) {
      t.search(hash).draw();
    }
  }

  $('#book-info-modal').on('hidden.bs.modal', function (e) {
    window.location.hash = window.location.hash.substring(1).replace(/\/popup/g, "");
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

  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', function() {
      APlayerObject.play();
    });
    navigator.mediaSession.setActionHandler('pause', function() {
      APlayerObject.pause();
    });
    navigator.mediaSession.setActionHandler('seekbackward', function() {
      APlayerObject.seek(Math.max(0, APlayerObject.audio.currentTime - 15)); // Skip back 15 seconds
    });
    navigator.mediaSession.setActionHandler('seekforward', function() {
      APlayerObject.seek(Math.min(APlayerObject.audio.duration, APlayerObject.audio.currentTime + 15)); // Skip forward 15 seconds  
    });
    navigator.mediaSession.setActionHandler('previoustrack', function() {
      APlayerObject.skipBack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', function() {
      APlayerObject.skipForward();
    });
  }

  APlayerObject.on('play', function (e) {
    if ('mediaSession' in navigator) {
      var audio = APlayerObject.list.audios[APlayerObject.list.index];
      navigator.mediaSession.metadata = new MediaMetadata({
        'title': audio.name,
        'artist': audio.artist,
        'album': audio.album,
        artwork: [{src: audio.cover}]
      });
      navigator.mediaSession.playbackState = "playing";
    }
  });

  APlayerObject.on('pause', function (e) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  });

  var timeUpdateCounter = 0;

  APlayerObject.on('timeupdate', function (e, two, three) {
    if (switchChapters !== null) {
      APlayerObject.list.switch(switchChapters);
      switchChapters = null;
      return;
    }
    else if (seekTime !== null) {
      if (APlayerObject.audio.currentTime >= 0.1) {
        APlayerObject.seek(seekTime);
        seekTime = null;
      }
      return;
    }
    timeUpdateCounter += 1;
    if (!window.localStorage || timeUpdateCounter % 25 !== 0) {
      return;
    }
    var progress = window.localStorage.getItem('progress');
    if (!progress) progress = '{}';
    progress = JSON.parse(progress);
    var audio = APlayerObject.list.audios[APlayerObject.list.index];
    progress[audio.artist + "|" + audio.album] = {
      'chapter': APlayerObject.list.index,
      'seek': APlayerObject.audio.currentTime
    };
    window.localStorage.setItem('progress', JSON.stringify(progress));
  });

  function getButtonForBookOfflineAvailablity(book) {
    var store = window.localStorage;
    if (!store) {
        return '';
    }
    var queued = store.getItem('offlineQueued');
    var downloaded = store.getItem('offlineDownloaded');
    if (downloaded.includes(book)) {
        return "<button type='button' title='Book is available offline' aria-label='Book is available offline' class='downloaded_book btn btn-outline-dark' disabled>" + availableOfflineText + "</button>";
    }
    if (queued.includes(book)) {
        return "<button type='button' title='Downloading book' aria-label='Downloading book' class='downloading_book btn btn-outline-dark' disabled>Downloading...</button>";
    }
    return "<button type='button' title='Download for offline use' aria-label='Download for offline use' class='download_book btn btn-outline-dark'>Store Offline</button>";
  }

  var toDownload = {};

  function startDownload(bookPath) {
    $.get("./catalog/books/" + bookPath + "/index.json")
    .done(function(data) {
      if (typeof data === 'string') data = JSON.parse(data);
      toDownload[bookPath] = [];
      var baseUrl = "./catalog/books/" + bookPath + "/";
      data.sections.forEach(function (section) {
        toDownload[bookPath].push(baseUrl + section.path);
      });
      toDownload[bookPath].push(baseUrl + "cover.jpg");
    })
    .fail(function(jqXHR, textStatus, errorThrown){
        alert("Failed to download book. Check your internet connection.");
    });
  }

  function downloadNextToDownload() {
    var url = null;
    for (var key in toDownload) {
      if (toDownload.hasOwnProperty(key)) {
        if (toDownload[key].length < 1) {
          var store = window.localStorage;
          if (!store) {
            return;
          }

          var downloaded = store.getItem('offlineDownloaded');
          downloaded = JSON.parse(downloaded);
          downloaded.push(key);
          store.setItem('offlineDownloaded', JSON.stringify(downloaded));

          var queued = store.getItem('offlineQueued');
          queued = JSON.parse(queued);
          queued = queued.filter(e => e !== key);
          store.setItem('offlineQueued', JSON.stringify(queued));

          refreshTableRows();
          delete toDownload[key];
        }
        else {
          url = toDownload[key].pop();
          break;
        }
      }
    }
    if (!url) {
      setTimeout(downloadNextToDownload, 3000);
      return
    }
    $.get(url).done(function() {
      downloadNextToDownload();
    })
    .fail(function() {
      toDownload.push(url);
      setTimeout(downloadNextToDownload, 3000);
    });
  }

  function refreshTableRows()
  {
    $('#books').find('tr').each(function() {
      t.row(this).invalidate().draw('page');
    });
  }

  function startAllQueuedDownloads() {
    var store = window.localStorage;
    if (!store) {
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

  function setInitialSearchValue() {
    var hash = window.location.hash.substring(1);
    if (hash.length > 0 && ['look', 'listen', 'learn'].indexOf(hash) === -1) {
      t.search(hash).draw();
      return
    }
    var store = window.localStorage;
    if (store) {
      var downloaded = store.getItem('offlineDownloaded');
      if (downloaded && downloaded != '[]') {
        t.search(availableOfflineText).draw();
        return;
      }
    }
    t.search('H. G. Wells').draw();
  }

  setInitialSearchValue();
  startAllQueuedDownloads();
  setTimeout(downloadNextToDownload, 5000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./serviceWorker.js');
  }

} );
