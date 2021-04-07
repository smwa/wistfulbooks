import requests
import json
import os
from glob import glob
from bs4 import BeautifulSoup
from bs4.element import NavigableString
from multiprocessing_tools import map as multithreadedMap

def main():
    SCRAPED_PAGES_DIR = 'scrapedPages'
    os.makedirs(SCRAPED_PAGES_DIR, mode=0o777, exist_ok=True)

    OUTPUT_DIR = 'books'
    os.makedirs(OUTPUT_DIR, mode=0o777, exist_ok=True)

    CHUNK_SIZE = 500
    CHUNK_NUM = 0

    catalog = getOrLoadCatalog()
    catalog = catalog[CHUNK_SIZE*CHUNK_NUM:CHUNK_SIZE*(CHUNK_NUM+1)]

    count = 0
    total = len(catalog)
    for book in catalog:
        handleBook(book, SCRAPED_PAGES_DIR, OUTPUT_DIR)
        count += 1
        if count % 15 == 0:
            print("Handled {:.1f}% books".format(100*count/total))
    print("Building index...")
    buildTotalIndex(OUTPUT_DIR)
    print("Done")

def getOrLoadCatalog():
    API_LIST_FILENAME = "catalogFromLibrivox.json"

    if os.path.exists(API_LIST_FILENAME):
        with open(API_LIST_FILENAME) as f:
            catalog = json.load(f)
    else:
        catalog = getListOfBooksFromApi()
        print("Fetched {} books from API".format(len(catalog)))
        with open(API_LIST_FILENAME, 'w') as outfile:
            json.dump(catalog, outfile)
    return catalog

def getListOfBooksFromApi():
    LIMIT = 5000
    URL = "https://librivox.org/api/feed/audiobooks?format=json&offset={}&limit={}"

    offset = 0
    results = []
    while True:
        print("getting {} - {}".format(offset, offset+LIMIT))
        with requests.get(URL.format(offset, LIMIT)) as r:
            offset += LIMIT
            if r.status_code > 299:
                break
            records = r.json()['books']
            for row in records:
                results.append(row)
            r.close()
    return results

def getOrSkipScrapedPage(book, SCRAPED_PAGES_DIR):
    id = book['id']
    url = book['url_librivox']
    filename = os.path.join(SCRAPED_PAGES_DIR, "{}.html".format(id))

    if os.path.exists(filename):
        with open(filename, 'r') as f:
            return f.read()

    if not url or url[0:26] == 'https://forum.librivox.org' or url == '' or 'project-not-available' in book['url_librivox']:
        return None

    try:
        with requests.get(url, allow_redirects=False) as r:
            r.raise_for_status()
            with open(filename, 'w') as f:
                html = r.text
                f.write(html)
                r.close()
                return html
    except Exception as e:
        print("Failed to fetch id {} with url {}: e".format(id, url, e))
        return None
    except KeyboardInterrupt as e:
        print("Keyboard interrupt during scrape page writing")
        if os.path.exists(filename):
            os.remove(filename)
        raise e

def downloadOrSkipCoverArt(soup, fullDirectory):
    coverArtFilename = os.path.join(fullDirectory, 'cover.jpg')
    if os.path.exists(coverArtFilename):
        return

    coverLink = findCoverArtLink(soup)
    if not coverLink or (coverLink[-4:].lower() != '.jpg' and coverLink[-4:].lower() != '.jpeg'):
        print("No cover link found for {}".format(coverArtFilename))
        return
    with requests.get(coverLink, stream=True) as r:
        if r.status_code != 200:
            print("Non Okay status {} for {}".format(r.status_code, coverArtFilename))
            r.close()
            return

        try:
            with open(coverArtFilename, 'wb') as f:
                for chunk in r:
                    f.write(chunk)
            r.close()
        except KeyboardInterrupt as e:
            print("Keyboard interrupt during cover art download")
            if os.path.exists(coverArtFilename):
                os.remove(coverArtFilename)
            raise e

def findCoverArtLink(soup):
    links = soup.find_all(class_="download-cover")
    coverLink = None
    for link in links:
        if link.string and link.string == 'Download cover art':
            if coverLink:
                raise Exception("Multiple cover links found")
            coverLink = link.get('href')
    return coverLink

def handleBook(book, SCRAPED_PAGES_DIR, OUTPUT_DIR):
    html = getOrSkipScrapedPage(book, SCRAPED_PAGES_DIR)
    if html is None:
        return

    soup = BeautifulSoup(html, 'html.parser')

    directory = book['url_librivox'].replace("https://librivox.org/", "").replace("http://librivox.org/", "").replace("/", "")
    fullDirectory = os.path.join(OUTPUT_DIR, directory)
    if not os.path.isdir(fullDirectory):
        os.mkdir(fullDirectory)

    downloadOrSkipCoverArt(soup, fullDirectory)
    
    buildIndex(book, soup, fullDirectory)

    soup.decompose()

def buildIndex(book, soup, fullDirectory):
    jsonPath = os.path.join(fullDirectory, 'index.json')

    if os.path.exists(jsonPath):
        return

    data = {
        'title': book['title'],
        'description': book['description'],
        'duration': book['totaltimesecs'],
        'language': book['language'],
        'authors': []
    }
    if book['copyright_year']:
        data['copyright_year'] = book['copyright_year']
    for author in book['authors']:
        data['authors'].append({
            'id': author['id'],
            'name': "{} {}".format(author['first_name'], author['last_name']),
        })

    if not soup.find('table', 'chapter-download'):
        print("Project is invalid {}".format(book['url_librivox']))
        return

    # Genres
    genreTag = soup.find('p', class_="book-page-genre")
    if genreTag:
        genres = genreTag.get_text(" ", strip=True).replace("Genre(s): ", '').split(',')
        genres = [x.strip() for x in genres if x.strip() != '']
        data['genres'] = genres
    else:
        print("No genres for {}, {}".format(directory, book['url_librivox']))

    #Product Details
    detailsTag = soup.find('dl', class_='product-details')
    details = []
    if detailsTag:
        for tag in detailsTag.children:
            if tag.name == 'dt':
                key = tag.get_text().replace(":", "")
                if key in ['Zip file size', 'Running Time', 'Catalog date']:
                    continue
                sib = tag.next_element.next_element.next_element
                value = str(sib.string)
                value = value.strip()
                if key and value:
                    details.append({'role': key, 'name': value})
    if len(details) > 0:
        data['supporters'] = details

    links = soup.find_all("a", class_="play-btn")

    headerTags = soup.find("table", class_="chapter-download").find_all('th')
    headerToIndex = {}
    i = 0
    for t in headerTags:
        headerToIndex[t.string] = i
        i += 1
    sections = []

    for link in links:
        text = None
        href = link.get('href')
        for child in link.parent.children:
            if isinstance(child, NavigableString):
                text = child.string
        if text:
            sectionId = int(text)
            labelRef = link.parent
            for i in range(headerToIndex['Chapter']):
                labelRef = labelRef.find_next('td')
            label = labelRef.get_text()
            readerIds = []
            readerLinks = link.parent
            for i in range(headerToIndex['Reader']):
                readerLinks = readerLinks.find_next('td')
            readerLinks = readerLinks.find_all('a')
            for readerLink in readerLinks:
                readerId = readerLink.get('href').replace("https://librivox.org/reader/", '')
                if readerId != '':
                    try:
                        readerIds.append(int(readerId))
                    except Exception as e:
                        print("Bad reader id in {} from section {}, bailing".format(directory, sectionId))
                        return
            durationRef = link.parent
            for i in range(headerToIndex['Time']):
                durationRef = durationRef.find_next('td')
            durationString = durationRef.get_text()
            durationParts = durationString.split(':')
            duration = 0
            try:
                duration += int(durationParts[0]) * 3600
                duration += int(durationParts[1]) * 60
                duration += int(durationParts[2])
            except Exception as e:
                print("Failed to parse duration {} from {}, {}".format(durationString, directory, book['id']))
                return
            sections.append({
                'section': sectionId,
                'title': label.strip(),
                'readers': readerIds,
                'path': href,
                'duration': duration
            })

    data['sections'] = sections
    try:
        with open(jsonPath, 'w') as f:
            json.dump(data, f)
    except KeyboardInterrupt as e:
        print("Keyboard interrupt during index writing")
        if os.path.exists(filename):
            os.remove(filename)
        raise e

def buildTotalIndex(bookDir):
    catalog = {'data': []}
    files = glob(os.path.join(bookDir, '*/index.json'))
    for book in multithreadedMap(filenameToBook, files):
        catalog['data'].append(book)
    with open("catalog.json", 'w') as f:
        json.dump(catalog, f)
    print("Wrote {} books to catalog.json".format(str(len(catalog['data']))))

def filenameToBook(filename):
    with open(filename, 'r') as handle:
        book = json.load(handle)
        return [
            book['title'],
            ", ".join(map(lambda author : author['name'].strip(), book['authors'])),
            "{:.0f}".format(book['duration'] / 60),
            ", ".join(book['genres']),
            book['language'],
            book['copyright_year'],
            os.path.basename(os.path.dirname(filename))
        ]

if __name__ == '__main__':
    main()
