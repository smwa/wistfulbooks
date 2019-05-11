$(document).ready(function() {
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
                'orderable': false,
                'searchable': false,
                'render': function(bookPath) {
                    return "<input type='hidden' class='book_path' value='" + bookPath + "'>"
                         + "<div class='btn-group' role='group' aria-label='Book actions'>"
                         + "<button type='button' title='Info' aria-label='Show book information' class='book_info btn btn-outline-dark'>&#8505;</button>"
                         + "<button type='button' title='Play' aria-label='Play book' class='play_book btn btn-outline-dark'>&#9654;</button>"
                         + "</div>";
                }
            }
        ]
    });

  $(document).on('click', ".book_info", function (ev) {
    $('.book-info-modal-description').html('<img src="assets/img/loading.svg">');
    var path = $(ev.target).closest('td').find(".book_path").val();
    $.get("./catalog/books/" + path + "/index.json")
    .done(function(data) {
        if (typeof data === 'string') data = JSON.parse(data);
        $('.book-info-modal-title').text(data.title);
        $('.book-info-modal-description').html(data.description);
        var coverArtPath = './catalog/books/' + path + '/cover.jpg';
        $('.book-info-modal-cover-art').attr('src', coverArtPath).css('display', '');
        $('.book-info-modal-supporters').html('');
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

} );
