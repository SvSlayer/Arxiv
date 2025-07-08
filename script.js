document.addEventListener('DOMContentLoaded', () => {

    // Get DOM elements
    const keywordsInput = document.getElementById('keywords-input');
    const searchButton = document.getElementById('search-button');
    const statusArea = document.getElementById('status-area');
    const resultsContainer = document.getElementById('results-container');
    const downloadControls = document.getElementById('download-controls');
    const downloadButton = document.getElementById('download-button');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const paginationControls = document.getElementById('pagination-controls');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    // Variables to manage application state
    let allPapers = [];
    let selectedPapers = new Set();
    let currentPage = 1;
    const papersPerPage = 10;
    const MAX_RESULTS = 100; // Maximum papers to fetch from API

    /**
     * Handles the main search logic by fetching data directly from the arXiv API.
     */
    const handleSearch = async () => {
        const userInput = keywordsInput.value.trim();
        if (!userInput) {
            statusArea.textContent = 'Please enter keywords to start.';
            return;
        }
        resetState();
        setLoading(true, 'Searching for papers, please wait...');

        const formattedQuery = userInput.split(/\s+/).join('+AND+');
        const apiUrl = `https://export.arxiv.org/api/query?search_query=all:${formattedQuery}&max_results=${MAX_RESULTS}&sortBy=submittedDate&sortOrder=descending`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`arXiv API error: ${response.statusText}`);
            
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const entries = xmlDoc.getElementsByTagName('entry');

            allPapers = Array.from(entries).map(entry => {
                const title = entry.querySelector('title').textContent.trim().replace(/\s+/g, ' ');
                const authors = Array.from(entry.querySelectorAll('author name')).map(author => author.textContent.trim());
                const published = new Date(entry.querySelector('published').textContent).toLocaleDateString();
                const summary = entry.querySelector('summary').textContent.trim().replace(/\s+/g, ' ');
                const pdfLink = entry.querySelector('link[title="pdf"]');
                const pdfUrl = pdfLink ? pdfLink.getAttribute('href') : null;
                const id = entry.querySelector('id').textContent.trim();

                return { id, title, authors, published, summary, pdfUrl };
            });

            if (allPapers.length > 0) {
                currentPage = 1;
                renderPage();
                statusArea.textContent = `Found ${allPapers.length} unique papers.`;
                downloadControls.classList.remove('hidden');
                paginationControls.classList.remove('hidden');
            } else {
                statusArea.textContent = 'No papers found for those keywords.';
            }

        } catch (error) {
            console.error('Error fetching data from arXiv:', error);
            statusArea.textContent = 'Failed to fetch data from arXiv. Please check your connection or try again later.';
        } finally {
            setLoading(false);
        }
    };
    
    /**
     * Renders the papers for the current page and pagination controls.
     */
    function renderPage() {
        resultsContainer.innerHTML = '';
        const startIndex = (currentPage - 1) * papersPerPage;
        const endIndex = startIndex + papersPerPage;
        const papersOnPage = allPapers.slice(startIndex, endIndex);

        papersOnPage.forEach(paper => renderPaper(paper));
        renderPagination();
        updateDownloadButtonState();
        
        selectAllCheckbox.checked = papersOnPage.length > 0 && papersOnPage.every(p => selectedPapers.has(p.id));
    }

    /**
     * Creates and displays a single search result card with an abstract.
     */
    function renderPaper(paper) {
        const card = document.createElement('div');
        card.className = 'bg-gray-800 p-5 rounded-lg border border-gray-700 flex flex-col gap-4';
        
        const isSelected = selectedPapers.has(paper.id);

        card.innerHTML = `
            <div class="flex gap-4 items-start">
                <div class="flex-shrink-0 pt-1">
                    <input type="checkbox" class="paper-checkbox h-5 w-5 rounded border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-700" data-id="${paper.id}" ${isSelected ? 'checked' : ''}>
                </div>
                <div class="flex-grow">
                    <h3 class="text-xl font-bold text-white mb-2">${paper.title}</h3>
                    <div class="mb-4">
                        <p class="text-sm text-gray-400 font-semibold mb-2">Authors:</p>
                        <div class="flex flex-wrap gap-2">${paper.authors.map(author => `<span class="bg-gray-700 text-gray-300 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">${author}</span>`).join('')}</div>
                    </div>
                    <div class="flex justify-between items-center">
                        <p class="text-sm text-gray-400">Published: <span class="font-medium text-gray-300">${paper.published}</span></p>
                        <div class="flex items-center gap-4">
                             <button class="toggle-summary-btn text-sm text-gray-400 hover:text-white transition-colors">Show Abstract</button>
                            ${paper.pdfUrl ? `<a href="${paper.pdfUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 transition-colors">View PDF</a>` : `<span class="text-sm text-red-400">PDF Not Available</span>`}
                        </div>
                    </div>
                </div>
            </div>
            <div class="summary pl-10 pr-5 text-gray-400 text-sm">
                <p class="font-semibold text-gray-300 mb-1">Abstract:</p>
                ${paper.summary}
            </div>
        `;
        resultsContainer.appendChild(card);
    }
    
    /**
     * Updates pagination controls (buttons and page info).
     */
    function renderPagination() {
        if(allPapers.length === 0) return;
        const totalPages = Math.ceil(allPapers.length / papersPerPage);
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = currentPage === totalPages;
    }

    /**
     * FUNGSI DOWNLOAD VERSI BARU (ALTERNATIF 1)
     * Karena server arXiv memblokir proxy, kita ubah perilakunya menjadi
     * "Buka setiap PDF yang dipilih di tab baru".
     */
    const handleDownload = () => {
        const papersToDownload = allPapers.filter(p => selectedPapers.has(p.id));
        if (papersToDownload.length === 0) {
            alert('No papers selected for download.');
            return;
        }

        // Beri peringatan kepada pengguna tentang pop-up
        const userConfirmation = confirm(
            `This will attempt to open ${papersToDownload.length} new tab(s).\n\nPlease ensure your browser's pop-up blocker is disabled for this site.\n\nDo you want to continue?`
        );

        if (!userConfirmation) {
            return;
        }
        
        let openCount = 0;
        papersToDownload.forEach(paper => {
            if (paper.pdfUrl) {
                // Pastikan URL selalu HTTPS
                const securePdfUrl = paper.pdfUrl.replace('http://', 'https://');
                // Buka URL langsung di tab baru
                window.open(securePdfUrl, '_blank');
                openCount++;
            }
        });

        if (openCount > 0) {
            alert(`${openCount} paper(s) have been opened in new tabs.`);
        } else {
            alert('No valid PDF links found for the selected papers.');
        }
    };

    // --- Helper Functions & Event Listeners ---
    
    function setLoading(isLoading, message = '') {
        searchButton.disabled = isLoading;
        // Tombol download tidak perlu dinonaktifkan saat loading dengan metode baru
        // downloadButton.disabled = isLoading || selectedPapers.size === 0;
        
        if (isLoading) {
            searchButton.classList.add('opacity-50', 'cursor-not-allowed');
            statusArea.innerHTML = `<div class="flex justify-center items-center space-x-2"><div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>${message}</span></div>`;
        } else {
            searchButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function resetState() {
        allPapers = [];
        selectedPapers.clear();
        currentPage = 1;
        resultsContainer.innerHTML = '';
        downloadControls.classList.add('hidden');
        paginationControls.classList.add('hidden');
        statusArea.textContent = 'Enter keywords to begin your search.';
    }

    function updateDownloadButtonState() {
        downloadButton.disabled = selectedPapers.size === 0;
    }

    // Event Listeners
    searchButton.addEventListener('click', handleSearch);
    keywordsInput.addEventListener('keypress', e => e.key === 'Enter' && handleSearch());
    downloadButton.addEventListener('click', handleDownload);
    
    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderPage(); window.scrollTo(0, 0); }
    });

    nextPageButton.addEventListener('click', () => {
        const totalPages = Math.ceil(allPapers.length / papersPerPage);
        if (currentPage < totalPages) { currentPage++; renderPage(); window.scrollTo(0, 0); }
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        const papersOnPage = allPapers.slice((currentPage - 1) * papersPerPage, currentPage * papersPerPage);
        papersOnPage.forEach(paper => {
            if (e.target.checked) { selectedPapers.add(paper.id); } else { selectedPapers.delete(paper.id); }
        });
        renderPage();
    });

    resultsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('paper-checkbox')) {
            const id = e.target.dataset.id;
            if (e.target.checked) { selectedPapers.add(id); } else { selectedPapers.delete(id); }
            updateDownloadButtonState();
            // Re-check "Select All" status
            const papersOnPage = allPapers.slice((currentPage - 1) * papersPerPage, currentPage * papersPerPage);
            selectAllCheckbox.checked = papersOnPage.length > 0 && papersOnPage.every(p => selectedPapers.has(p.id));
        }
    });
    
    resultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-summary-btn')) {
            const summaryDiv = e.target.closest('.flex-grow').parentElement.nextElementSibling;
            summaryDiv.classList.toggle('expanded');
            e.target.textContent = summaryDiv.classList.contains('expanded') ? 'Hide Abstract' : 'Show Abstract';
        }
    });
});