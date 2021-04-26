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
        'scrollY': window.innerWidth >= 928 ? 'calc(100vh - 195px)' : 'calc(100vh - 234px)',
        'scroller': true,
        'responsive': true,
        'processing': true,
        'oLanguage': {
          'sProcessing': '<div style="top: 0"><img src="assets/img/loading.svg"></div>',
        },
        'search': {
          'search': ""
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
        ],
        initComplete: function () {
          var searchLabel = $("#books_filter label");
          $("#books_length").parent().remove();
          $("#books_filter").parent().addClass("col-md-12").removeClass("col-md-6");
          this.api().columns().every( function () {
              var column = this;
              if (![1, 3].includes(column.index())) {
                return;
              }
              var select = $('<select class="form-control form-control-sm"><option value=""></option></select>')
                  .on( 'change', function () {
                      var val = $.fn.dataTable.util.escapeRegex(
                          $(this).val()
                      );

                      column
                          .search( val ? regexWithEllipsis(val) : '', true, false )
                          .draw();
                  } );
              
              var label = $('<label>' + $(column.header()).text().trim() + ": </label>").insertBefore(searchLabel);
              var span = $('<span style="display: inline-block; padding-right: 8px;" />').appendTo(label);
              select.appendTo(span);

              var splitValues = column.data().map(function (data) { return data.split(",").map(function(d) {return d.trim();}) });
              splitValues = splitValues.reduce(function (valueList, current) { return current.concat(valueList) }, []);
              splitValues = splitValues.map(function (data) {return addEllipsis(data, 30);});
              splitValues = splitValues.filter(function (data) { return data !== ""});
              splitValues = [...new Set(splitValues)];
              splitValues.sort();
              splitValues.forEach( function ( d ) {
                  select.append( '<option value="'+d+'">'+d+'</option>' )
              } );
          } );
        }
    });
  t.on('search.dt', function (ev) {
    if (window.location.hash.length > 1) {
      window.location.hash = "";
    }
  });

  $(document).on('click', ".book_info", function (ev) {
    $('.book-info-modal-description').html('<img src="assets/img/loading.svg">');
    $('.book-info-modal-title').text('Loading...');
    $('.book-info-modal-cover-art').css('display', 'none');
    $('.book-info-modal-supporters').html('');
    var path = $(ev.target).closest('td').find(".book_path").text();
    $.get("./catalog/books/" + path + ".json")
    .done(function(data) {
        if (typeof data === 'string') data = JSON.parse(data);
        $('.book-info-modal-title').text(data.title);
        $('.book-info-modal-description').html(data.description);
        $('.book-info-modal-cover-art').attr('src', data.coverArt);
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
  });

  $(document).on('click', '.play_book', function (ev) {
    var path = $(ev.target).closest('td').find(".book_path").text();
    $.get("./catalog/books/" + path + ".json")
    .done(function(data) {
        if (typeof data === 'string') data = JSON.parse(data);
        APlayerObject.list.clear();
        var authors = data.authors.map(function (author) { return author.name; }).join(', ');
        data.sections.forEach(function (section) {
            APlayerObject.list.add({
                name: section.title,
                artist: authors,
                url: section.path,
                cover: data.coverArt,
                album: data.title
            });
        });

        // Jump to player
        location.href = "#listen";

        APlayerObject.play();

        // For loading the last played part of tracks
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
      setTimeout(function () {
        ev.target.innerHTML = "Share";
      }, 5000);
    }
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
    $.get("./catalog/books/" + bookPath + ".json")
    .done(function(data) {
      if (typeof data === 'string') data = JSON.parse(data);
      toDownload[bookPath] = [];
      data.sections.forEach(function (section) {
        toDownload[bookPath].push(section.path);
      });
      toDownload[bookPath].push(data.coverArt);
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
    if (url.search(".mp3") < 0) {
      var preloader = new Image();
      preloader.onload = function () {
        preloader.parentNode.removeChild(preloader);
        downloadNextToDownload();
      };
      preloader.onerror = function (ev) {
        preloader.parentNode.removeChild(preloader);
        console.log("failed", url, ev);
        toDownload[key].push(url);
        setTimeout(downloadNextToDownload, 3000);
      };
    }
    else {
      var preloader = new Audio();
      preloader.preload = "auto";
      preloader.addEventListener('canplaythrough', function() { 
        preloader.parentNode.removeChild(preloader);
        downloadNextToDownload();
      }, false);
      preloader.addEventListener('error', function() { 
        preloader.parentNode.removeChild(preloader);
        console.log("failed", url, ev);
        toDownload[key].push(url);
        setTimeout(downloadNextToDownload, 3000);
      }, false);
    }
    preloader.src = url;
    preloader.style.display = "none";
    document.body.appendChild(preloader);
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
    hash = decodeURIComponent(hash);
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
  }

  function addEllipsis(str, maxLength) {
    if (str.length > maxLength) {
      str = str.substring(0, maxLength - 3) + "...";
    }
    return str;
  }

  function regexWithEllipsis(val) {
    if (val.substring(val.length - 6) === "\\.\\.\\.") {
      return val.substring(0, val.length - 6);
    }
    return val;
  }

  setInitialSearchValue();
  startAllQueuedDownloads();
  setTimeout(downloadNextToDownload, 5000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./serviceWorker.js');
  }

} );
