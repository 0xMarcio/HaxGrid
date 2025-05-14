const SEVERITY_ORDER = { critical: 5, high: 4, medium: 3, low: 2, info: 1, unknown: 0 };
const SEVERITY_COLORS = {
    critical: '#ef4444', high: '#f97316', medium: '#facc15',
    low: '#34d399', info: '#60a5fa', unknown: '#a78bfa'
};
const SEVERITY_GRADIENTS = {
    critical: '#ff000026',
    high: '#f973162e',
    medium: '#facc152e',
    low: '#10b98129',
    info: '#3b82f633',
    unknown: '#8b5cf64d'
};
const DEFAULT_PAGE_SIZE = 24; // Adjusted default
const DEFAULT_SORT_BY = 'created_at';
const DEFAULT_SORT_ORDER = 'desc';
const DEFAULT_VIEW_MODE = 'grid';
const DEFAULT_DARK_MODE = true;
const LOCAL_STORAGE_KEY = 'nucleiExplorerState_v2'; // Updated version key
const GITHUB_BASE_URL = 'https://github.com/'
// const TEMPLATES_TOTAL;

let allTemplates = [];
let filteredTemplates = [];
let fuseInstance = null;
let appState = {
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sortBy: DEFAULT_SORT_BY,
    sortOrder: DEFAULT_SORT_ORDER,
    viewMode: DEFAULT_VIEW_MODE,
    filters: {
        search: '',
        severity: [],
        type: '',
        author: '',
        tags: [],
        statusFlags: { // Use flags for status
            is_early: null, // null = ignore, true = must be early, false = must not be early
            is_new: null,
            is_draft: null,

        },
        favoritesOnly: false,
    },
    favorites: [],
    darkMode: DEFAULT_DARK_MODE,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const loadingScreen = $('#loading-screen');
const loadingBar = $('#loading-bar');
const loadingText = $('#loading-text');
const loadingError = $('#loading-error');
const mainContent = $('.main-content');
const gridView = $('#grid-view');
const listView = $('#list-view');
const tableView = $('#table-view');
const tableBody = $('#table-body');
const gridViewBtn = $('#grid-view-btn');
const listViewBtn = $('#list-view-btn');
const tableViewBtn = $('#table-view-btn');
const settingsButton = $('#settings-button');
const settingsPanel = $('#settings-panel');
const settingsClose = $('#settings-close');
const settingsBackdrop = $('.settings-backdrop');
const templateModal = $('#template-modal');
const modalClose = $('#modal-close');
const helpButton = $('#help-button');
const helpModal = $('#help-modal');
const remoteRepoBtn = $('#remote-repo-btn');
const repoModal = $('#repo-modal');
const themeToggle = $('#theme-toggle');
const toast = $('#toast');
const toastIcon = $('#toast-icon');
const toastMessage = $('#toast-message');
const toastDescription = $('#toast-description');
const toastClose = $('#toast-close');
const globalSearchInput = $('#global-search');
const severityFilterButtonsContainer = $('#severity-filter-buttons');
const typeFilterSelect = $('#type-filter');
const authorFilterSelect = $('#author-filter');
const tagsFilterInput = $('#tags-filter');
const favoritesBtn = $('#favorites-btn');
const resetFiltersBtn = $('#reset-filters-btn');
const exportJsonBtn = $('#export-json-btn');
const showingCountEl = $('#showing-count');
const showingToCountEl = $('#showing-to-count');
const totalCountEl = $('#total-count');
const filterIndicator = $('#filter-indicator');
const sortBySelect = $('#sort-by');
const sortOrderBtn = $('#sort-order');
const perPageSelect = $('#per-page');
const paginationControls = $('#pagination-controls');
const currentPageEl = $('#current-page');
const totalPagesEl = $('#total-pages');
const settingDarkModeToggle = $('#setting-dark-mode');
const settingReloadBtn = $('#setting-reload-templates');
const settingClearFavoritesBtn = $('#setting-clear-favorites');
const settingClearStorageBtn = $('#setting-clear-storage');

let chartInstance = null;

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    console.log("Initializing Nuclei Explorer Pro...");
    loadStateFromLocalStorage();
    applyInitialSettings();
    setupEventListeners();
    showLoadingProgress('Loading templates...', 10);

    try {
        const response = await fetch('templates.json');
        showLoadingProgress('Fetching data...', 25);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - Could not fetch templates.json`);
        }
        const rawData = await response.json();
        showLoadingProgress('Parsing data...', 40);

        const templatesArray = rawData?.results;
        const TEMPLATES_TOTAL = rawData.total;
        if (!Array.isArray(templatesArray)) {
             throw new Error("Invalid data structure in templates.json. Expected an object with a 'results' array.");
        }

        console.log(`Loaded ${templatesArray.length} raw template objects.`);
        if (rawData.total === 0) {
             console.warn("The 'results' array in templates.json is empty.");
             showLoadingError("No templates found in the 'results' array of templates.json.");
             return;
         }

        showLoadingProgress('Processing templates...', 50);
        allTemplates = templatesArray.map(processTemplateData);
        console.log(`Processed ${allTemplates.length} templates.`);


        const fuseOptions = {
            keys: [
                { name: 'id', weight: 0.9 },
                { name: 'name', weight: 2.0 },
                { name: 'description', weight: 1 },
                { name: 'tags', weight: 0.4 },
                { name: 'author', weight: 0.2 },
                { name: 'raw_content', weight: 0.1 },
                { name: 'path', weight: 0.5 }
            ],
            includeScore: true,
            threshold: 0.4,
            ignoreLocation: false,
            minMatchCharLength: 3,
         };
         fuseInstance = new Fuse(allTemplates, fuseOptions);
         console.log("Fuse.js initialized.");

        showLoadingProgress('Populating UI...', 70);
        populateFilters();
        updateStatistics();
        initCharts();

        showLoadingProgress('Rendering view...', 90);
        updateDisplay();

        showLoadingProgress('Finalizing...', 100);
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.pointerEvents = 'none';
            mainContent.classList.add('visible');
            setTimeout(() => loadingScreen.classList.add('hidden'), 500);
            console.log("Initialization complete.");
            animateElements();
            initTooltips();
        }, 300);

    } catch (error) {
        console.error('Failed to load or process templates.json:', error);
        showLoadingError(`Error: ${error.message}. Please ensure 'templates.json' is in the same folder, is valid JSON, and has a 'results' array.`);
    }
}

function showLoadingProgress(message, percentage) {
    if (loadingText) loadingText.textContent = message;
    if (loadingBar) loadingBar.style.width = `${percentage}%`;
}

function showLoadingError(message) {
    console.error("Loading Error:", message);
    if (loadingText) loadingText.textContent = 'Error!';
    if (loadingError) {
        loadingError.textContent = message;
        loadingError.classList.remove('hidden');
    }
    if (loadingBar) {
        loadingBar.style.backgroundColor = '#ef4444';
        loadingBar.style.width = '100%';
    }
    loadingScreen.style.opacity = '1';
    loadingScreen.style.pointerEvents = 'auto';
}

function processTemplateData(template, index) {
    const processed = {};

    processed.id = String(template.id || `template-${index}`).trim();
    processed.name = String(template.name || 'Unnamed Template').trim();
    processed.description = String(template.description || '').trim();
    processed.severity = (String(template.severity || 'unknown').toLowerCase().trim());
    processed.ref = (String(template.ref || 'unknown').toLowerCase().trim());
    if (!SEVERITY_ORDER.hasOwnProperty(processed.severity)) {
        processed.severity = 'unknown';
    }

    processed.author = Array.isArray(template.author)
        ? template.author.map(a => String(a).trim()).filter(Boolean)
        : (template.author ? [String(template.author).trim()].filter(Boolean) : []);

    processed.tags = Array.isArray(template.tags)
        ? template.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
        : [];

    processed.references = Array.isArray(template.references)
        ? template.references.map(r => String(r).trim()).filter(Boolean)
        : [];

    processed.classification = template.classification || {};
    processed.metadata = template.metadata || {};
    processed.raw_content = typeof template.raw === 'string' ? template.raw : '';
    processed.path = typeof template.uri === 'string' ? GITHUB_BASE_URL + template.ref.trim().replace(':', '/blob/') + '/' + template.uri.trim() : null;
    processed.type = String(template.type || 'Unknown').trim().toLowerCase();

    processed.is_draft = !!template.is_draft;
    processed.is_early = !!template.is_early;
    processed.is_new = !!template.is_new;
    processed.is_pdresearch = !!template.is_pdresearch;
    processed.is_pdteam = !!template.is_pdteam;
    processed.is_github = !!template.is_github;
    processed.is_pdtemplate = !!template.is_pdtemplate;
    
    const parseDate = (dateStr) => {
        if (!dateStr) return moment(0);
        const m = moment.utc(dateStr, moment.ISO_8601); // Assume UTC ISO 8601
        return m.isValid() ? m : moment(0);
    };
    processed.created_at_moment = parseDate(template.created_at);
    processed.updated_at_moment = parseDate(template.updated_at);

    if (!processed.updated_at_moment.isValid() || processed.updated_at_moment.isBefore(processed.created_at_moment)) {
        processed.updated_at_moment = processed.created_at_moment;
    }

    // Combine boolean flags into a status array for easier display/filtering later
    processed.statusFlags = [];
    if (processed.is_draft) processed.statusFlags.push('draft');
    if (processed.is_early) processed.statusFlags.push('early');
    if (processed.is_new) processed.statusFlags.push('new');
    if (processed.is_github) processed.statusFlags.push('github');
    if (processed.is_pdteam) processed.statusFlags.push('pdteam');
    if (processed.is_pdresearch) processed.statusFlags.push('pdresearch');
    if (processed.is_pdtemplate) processed.statusFlags.push('pdtemplate');

    return processed;
}


function saveStateToLocalStorage() {
    try {
        const stateToSave = {
            pageSize: appState.pageSize,
            sortBy: appState.sortBy,
            sortOrder: appState.sortOrder,
            viewMode: appState.viewMode,
            favorites: appState.favorites,
            darkMode: appState.darkMode,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
        console.log("State saved to localStorage");
    } catch (e) {
        console.error("Failed to save state to localStorage:", e);
        showToast('Warning', 'Could not save settings. Browser storage might be full.', 'warning');
    }
}

function loadStateFromLocalStorage() {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            appState.pageSize = [9, 16, 24, 48, 99].includes(parsedState.pageSize) ? parsedState.pageSize : DEFAULT_PAGE_SIZE;
            appState.sortBy = ['updated_at', 'created_at', 'severity', 'name', 'id', 'author', 'type'].includes(parsedState.sortBy) ? parsedState.sortBy : DEFAULT_SORT_BY;
            appState.sortOrder = ['desc', 'asc'].includes(parsedState.sortOrder) ? parsedState.sortOrder : DEFAULT_SORT_ORDER;
            appState.viewMode = ['grid', 'list', 'table'].includes(parsedState.viewMode) ? parsedState.viewMode : DEFAULT_VIEW_MODE;
            appState.favorites = Array.isArray(parsedState.favorites) ? parsedState.favorites.filter(id => typeof id === 'string') : [];
            appState.darkMode = typeof parsedState.darkMode === 'boolean' ? parsedState.darkMode : DEFAULT_DARK_MODE;
            console.log("State loaded from localStorage:", appState);
        } catch (e) {
            console.error("Failed to parse saved state:", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    } else {
         console.log("No saved state found, using defaults.");
    }
}

 function clearLocalStorage() {
     localStorage.removeItem(LOCAL_STORAGE_KEY);
     console.log("Local storage cleared.");
 }

function applyInitialSettings() {
     setDarkMode(appState.darkMode);
     settingDarkModeToggle.checked = appState.darkMode;
     setViewMode(appState.viewMode, false);
     perPageSelect.value = appState.pageSize;
     sortBySelect.value = appState.sortBy;
     updateSortOrderButtonIcon();
}

function updateDisplay() {
    if (!allTemplates.length) {
         console.warn("updateDisplay called with no templates loaded.");
         const noDataHtml = `<div class="text-center col-span-full py-10 text-gray-500">No templates loaded. Check templates.json.</div>`;
         gridView.innerHTML = noDataHtml;
         listView.innerHTML = noDataHtml;
         tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500">No templates loaded. Check templates.json.</td></tr>`;
         updateResultCounts(0, 0, 0);
         updatePaginationControls(1);
         return;
    }

    console.time("updateDisplay");
    applyFiltersAndSort();

    const totalFiltered = filteredTemplates.length;
    const totalPages = Math.ceil(totalFiltered / appState.pageSize) || 1;
    if (appState.currentPage > totalPages) {
         appState.currentPage = totalPages;
    }

    const startIndex = (appState.currentPage - 1) * appState.pageSize;
    const endIndex = Math.min(startIndex + appState.pageSize, totalFiltered);
    const templatesToShow = filteredTemplates.slice(startIndex, endIndex);

    console.time("renderView");
    switch(appState.viewMode) {
        case 'grid': renderGridView(templatesToShow); break;
        case 'list': renderListView(templatesToShow); break;
        case 'table': renderTableView(templatesToShow); break;
    }
    console.timeEnd("renderView");

    updateResultCounts(startIndex, templatesToShow.length, totalFiltered);
    updatePaginationControls(totalPages);
    updateFilterIndicator();
    console.timeEnd("updateDisplay");
}

function applyFiltersAndSort() {
    console.time("applyFiltersAndSort");
    let result = [];
    const filters = appState.filters;

     if (filters.search && fuseInstance) {
        const searchResults = fuseInstance.search(filters.search);
        result = searchResults.map(fuseResult => fuseResult.item);
        console.log(`Fuse search for "${filters.search}" returned ${result.length} results.`);
    } else {
        result = [...allTemplates];
    }

    result = result.filter(template => {
        if (filters.severity.length > 0 && !filters.severity.includes(template.severity)) {
            return false;
        }
        if (filters.type && template.type !== filters.type) {
            return false;
        }
         if (filters.author && !(template.author?.includes(filters.author))) {
            return false;
        }
         if (filters.tags.length > 0) {
            const filterTagsLower = filters.tags;
            if (!filterTagsLower.every(tag => template.tags?.includes(tag))) {
                 return false;
            }
         }

        if (filters.statusFlags.is_draft !== null && template.is_draft !== filters.statusFlags.is_draft) {
             return false;
        }
        if (filters.statusFlags.is_early !== null && template.is_early !== filters.statusFlags.is_early) {
            return false;
        }
         if (filters.statusFlags.is_new !== null && template.is_new !== filters.statusFlags.is_new) {
             return false;
         }

        if (filters.favoritesOnly && !appState.favorites.includes(template.id)) {
            return false;
        }

        return true;
    });
     console.log(`Applied standard filters, ${result.length} templates remaining.`);

    result.sort((a, b) => {
        let valA, valB;
        const compareStrings = (strA, strB) => (strA || '').localeCompare(strB || '');

        switch (appState.sortBy) {
            case 'name':
                valA = a.name; valB = b.name;
                return compareStrings(valA, valB);
            case 'id':
                valA = a.id; valB = b.id;
                return compareStrings(valA, valB);
            case 'severity':
                valA = SEVERITY_ORDER[a.severity] ?? -1;
                valB = SEVERITY_ORDER[b.severity] ?? -1;
                break;
            case 'type':
                valA = a.type; valB = b.type;
                return compareStrings(valA, valB);
            case 'author':
                valA = a.author?.[0]; valB = b.author?.[0];
                return compareStrings(valA, valB);
            case 'created_at':
                valA = a.created_at_moment; valB = b.created_at_moment;
                break;
            case 'updated_at':
            default:
                valA = a.updated_at_moment; valB = b.updated_at_moment;
                break;
        }

         let comparison = 0;
         if (valA > valB) comparison = 1;
         else if (valA < valB) comparison = -1;

        return appState.sortOrder === 'desc' ? (comparison * -1) : comparison;
    });

    filteredTemplates = result;
    console.timeEnd("applyFiltersAndSort");
}

function renderGridView(templates) {
    const container = gridView;
    if (!templates.length) {
        container.innerHTML = `<div class="text-center col-span-full py-10 text-gray-500">No templates match your criteria.</div>`;
        return;
    }
    container.innerHTML = templates.map(template => createTemplateCard(template)).join('');
    addCardActionListeners(container);
}

function renderListView(templates) {
    const container = listView;
     if (!templates.length) {
        container.innerHTML = `<div class="text-center py-10 text-gray-500">No templates match your criteria.</div>`;
        return;
    }
    container.innerHTML = templates.map(template => createTemplateListItem(template)).join('');
    addCardActionListeners(container);
}

function renderTableView(templates) {
     const container = tableBody;
     if (!templates.length) {
        container.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500">No templates match your criteria.</td></tr>`;
        return;
    }
    container.innerHTML = templates.map(template => createTemplateTableRow(template)).join('');
    addCardActionListeners(container);
}

function addCardActionListeners(container) {
    container.removeEventListener('click', handleCardClick);
    container.addEventListener('click', handleCardClick);
}

function handleCardClick(e) {
     const button = e.target.closest('button, a');
     const card = e.target.closest('.template-card, .template-list-item, .template-table-row');

     if (!card) return;

     const templateId = card.dataset.id;
     if (!templateId) return;

     if (button) {
        e.stopPropagation();
        if (button.classList.contains('favorite-button')) {
            toggleFavorite(templateId);
            updateFavoriteButtonState(button, appState.favorites.includes(templateId));
        } else if (button.classList.contains('copy-id-button')) {
            copyToClipboard(templateId, 'Template ID');
        } else if (button.classList.contains('github-button')) {
            viewOnGitHub(templateId);
        } else if (button.classList.contains('view-details-button')) {
             openTemplateModal(templateId);
        }
    } else {
         openTemplateModal(templateId);
     }
}

 function getSeverityBadge(severity, size = 'normal') {
     severity = severity?.toLowerCase() || 'unknown';
     const gradient = SEVERITY_GRADIENTS[severity] || SEVERITY_GRADIENTS.unknown;
     const textClass = size === 'small' ? 'text-xs px-1.5 py-0.5' : 'text-xs font-medium px-2.5 py-1';
     return `<span class="${textClass} rounded-full text-white whitespace-nowrap shadow-sm" style="background: ${gradient};">${severity.charAt(0).toUpperCase() + severity.slice(1)}</span>`;
 }

 function getSeverityIcon(severity, classes = 'text-white') {
     severity = severity?.toLowerCase() || 'unknown';
     const iconClass = {
         critical: 'fa-radiation', high: 'fa-triangle-exclamation', medium: 'fa-circle-exclamation',
         low: 'fa-circle-info', info: 'fa-shield-halved', unknown: 'fa-circle-question'
     }[severity] || 'fa-circle-question';
     const colorClass = {
         critical: 'text-red-500', high: 'text-orange-500', medium: 'text-yellow-400',
         low: 'text-emerald-400', info: 'text-blue-400', unknown: 'text-violet-400'
     }[severity] || 'text-gray-400';
     return `<i class="fas ${iconClass} ${colorClass} ${classes.replace(/text-\w+-\d+/g, '')}"></i>`;
 }

 function getStatusIcons(statusFlags = []) {
     let iconsHtml = '';
     if (statusFlags.includes('draft')) {
         iconsHtml += '<i class="fas fa-pencil-alt text-gray-500" title="Draft"></i>';
     }
     if (statusFlags.includes('early')) {
         iconsHtml += '<i class="fas fa-crown text-yellow-500 ml-1" title="Early Access"></i>';
     }
      if (statusFlags.includes('new')) {
         iconsHtml += '<i class="fas fa-fire text-orange-400 ml-1" title="New"></i>';
     }
     // Add other icons based on flags like is_pdteam, is_pdresearch etc. if needed
     return iconsHtml;
 }


function formatTags(tags, limit = 4, tagStyle = '--tag-bg: #4f46e5;') {
     if (!tags || tags.length === 0) return '<span class="text-xs text-gray-500 italic">No tags</span>';
     const processedTags = tags.map(tag => String(tag || '').toLowerCase());
     const displayedTags = processedTags.slice(0, limit);
     const remainingCount = processedTags.length - limit;
     let html = displayedTags.map(tag =>
         `<span class="cyber-tag" style="${tagStyle}">${escapeHtml(tag)}</span>`
     ).join('');
     if (remainingCount > 0) {
         html += `<span class="cyber-tag" style="--tag-bg: #6b7280;" title="${escapeHtml(processedTags.slice(limit).join(', '))}">&nbsp;+${remainingCount}&nbsp;</span>`;
     }
     return html;
 }

 function formatAuthors(authors, limit = 2) {
     if (!authors || authors.length === 0) return '<span class="text-xs text-gray-500 italic">Unknown</span>';
      const displayed = authors.slice(0, limit).map(escapeHtml).join(', ');
      const remaining = authors.length - limit;
      const fullList = authors.map(escapeHtml).join(', ');
      return `<span title="Author(s): ${fullList}">${displayed}${remaining > 0 ? ` +${remaining}` : ''}</span>`;
 }

 function formatDate(dateMoment) {
     return dateMoment && moment.isMoment(dateMoment) && dateMoment.isValid() && dateMoment.unix() > 0
         ? dateMoment.fromNow()
         : '<span class="text-gray-500 italic">N/A</span>';
 }
 function formatAbsoluteDate(dateMoment, format = 'YYYY-MM-DD HH:mm UTC') {
     return dateMoment && moment.isMoment(dateMoment) && dateMoment.isValid() && dateMoment.unix() > 0
         ? dateMoment.format(format)
         : 'N/A';
 }

 function escapeHtml(unsafe) {
     if (typeof unsafe !== 'string') {
        if (unsafe === null || unsafe === undefined) return '';
        try {
            unsafe = String(unsafe);
        } catch (e) {
            return '';
        }
     }
     return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
 }

  function getFavoriteButtonHTML(templateId, isFavorite) {
    const iconClass = isFavorite ? 'fas fa-star text-yellow-400' : 'far fa-star';
    const title = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
    const activeClass = isFavorite ? 'favorite-active' : '';
    return `
        <button class="favorite-button text-gray-400 hover:text-white transition-colors p-1 rounded ${activeClass}" data-id="${escapeHtml(templateId)}" title="${title}">
            <i class="${iconClass}"></i>
        </button>`;
}

 function updateFavoriteButtonState(buttonElement, isFavorite) {
     if (!buttonElement) return;
     const icon = buttonElement.querySelector('i');
     if (!icon) return;

     if (isFavorite) {
         icon.className = 'fas fa-star text-yellow-400';
         buttonElement.classList.add('favorite-active');
         buttonElement.title = 'Remove from Favorites';
     } else {
         icon.className = 'far fa-star';
         buttonElement.classList.remove('favorite-active');
         buttonElement.title = 'Add to Favorites';
     }
 }

 function createTemplateCard(template) {
    const { id, name, description, severity, tags, author, updated_at_moment, statusFlags } = template;
    const path = GITHUB_BASE_URL + template.ref.replace(':', '/blob/') + '/' + template.uri;
    const isFavorite = appState.favorites.includes(id);
    const grad = SEVERITY_GRADIENTS[severity] || SEVERITY_GRADIENTS.unknown;
    const cardId = `card-${escapeHtml(id)}`;

     return `
    <div id="${cardId}" class="template-card bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg overflow-hidden hover-card-effect border border-gray-700 flex flex-col cursor-pointer h-full" data-id="${escapeHtml(id)}">
        <div class="flex items-start justify-between p-4">
             <div class="flex items-center overflow-hidden mr-2">
                 <div class="h-10 w-10 rounded-lg flex-shrink-0 flex items-center justify-center shadow-md" style="background: ${grad}">
                    ${getSeverityIcon(severity, 'text-xl')}
                 </div>
                 <div class="ml-3 overflow-hidden">
                      <h3 class="text-base font-semibold text-white truncate" title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
                      <p class="text-xs text-gray-400 truncate font-mono" title="${escapeHtml(id)}">${escapeHtml(id)}</p>
                 </div>
             </div>
             <div class="flex flex-col items-end space-y-1 flex-shrink-0">
                ${getSeverityBadge(severity, 'small')}
                <div class="flex items-center gap-1.5">${getStatusIcons(statusFlags)}</div>
             </div>
         </div>
         <div class="px-4 pb-4 flex-1">
            <p class="text-sm text-gray-300 line-clamp-3">${escapeHtml(description) || '<span class="italic text-gray-500">No description.</span>'}</p>
        </div>
         <div class="px-4 py-3 border-t border-gray-700 bg-gray-800 bg-opacity-50">
             <div class="flex flex-wrap gap-1 mb-3 min-h-[2rem]">
                 ${formatTags(tags, 3)}
             </div>
             <div class="flex justify-between items-center text-xs text-gray-400">
                 <span class="flex items-center" title="Last Updated: ${formatAbsoluteDate(updated_at_moment)}"><i class="far fa-clock mr-1.5"></i>${formatDate(updated_at_moment)}</span>
                 <div class="flex items-center space-x-3">
                     ${getFavoriteButtonHTML(id, isFavorite)}
                     <button class="copy-id-button text-gray-400 hover:text-white transition-colors p-1 rounded" data-id="${escapeHtml(id)}" title="Copy Template ID">
                         <i class="far fa-copy"></i>
                     </button>
                      <button class="github-button text-gray-400 hover:text-white transition-colors p-1 rounded ${!path ? 'opacity-30 cursor-not-allowed' : ''}" data-id="${escapeHtml(id)}" title="${path ? 'View on GitHub' : 'GitHub path not available'}" ${!path ? 'disabled' : ''}>
                         <i class="fab fa-github"></i>
                     </button>
                 </div>
             </div>
         </div>
     </div>`;
}

function createTemplateListItem(template) {
     const { id, name, description, severity, type, author, tags, updated_at_moment, path, statusFlags } = template;
     const isFavorite = appState.favorites.includes(id);
     const grad = SEVERITY_GRADIENTS[severity] || SEVERITY_GRADIENTS.unknown;
     const listItemId = `list-item-${escapeHtml(id)}`;

    return `
    <div id="${listItemId}" class="template-list-item bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl shadow-lg overflow-hidden hover-card-effect border border-gray-700 cursor-pointer" data-id="${escapeHtml(id)}">
        <div class="flex flex-col md:flex-row items-start md:items-center p-4 gap-4">
            <div class="flex-shrink-0 mt-1 md:mt-0">
                <div class="h-12 w-12 rounded-lg flex items-center justify-center shadow-md" style="background: ${grad}">
                    ${getSeverityIcon(severity, 'text-2xl')}
                </div>
            </div>
            <div class="flex-1 w-full min-w-0">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                     <div class="flex-1 min-w-0">
                        <h3 class="text-lg font-semibold text-white flex items-center gap-2 flex-wrap" title="${escapeHtml(name)}">
                            <span class="truncate inline-block max-w-full">${escapeHtml(name)}</span>
                            ${getSeverityBadge(severity, 'small')}
                            <span class="flex items-center gap-1.5">${getStatusIcons(statusFlags)}</span>
                         </h3>
                     </div>
                     <div class="flex space-x-2 flex-shrink-0">
                        ${getFavoriteButtonHTML(id, isFavorite)}
                        <button class="copy-id-button bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md transition-colors text-xs" data-id="${escapeHtml(id)}" title="Copy Template ID">
                            <i class="far fa-copy mr-1"></i> Copy ID
                        </button>
                        <button class="github-button bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md transition-colors text-xs ${!path ? 'opacity-50 cursor-not-allowed' : ''}" data-id="${escapeHtml(id)}" title="${path ? 'View on GitHub' : 'GitHub path not available'}" ${!path ? 'disabled' : ''}>
                            <i class="fab fa-github"></i>
                        </button>
                        <button class="view-details-button bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md transition-colors text-xs" data-id="${escapeHtml(id)}">
                            Details
                        </button>
                    </div>
                </div>
                <p class="text-xs text-gray-400 mb-2 flex flex-wrap gap-x-3 gap-y-1">
                    <span>ID: <span class="font-mono">${escapeHtml(id)}</span></span>
                    <span>Type: <span class="font-medium text-gray-300">${escapeHtml(type)}</span></span>
                    <span>Author: ${formatAuthors(author, 1)}</span>
                    <span title="${formatAbsoluteDate(updated_at_moment)}">Updated: ${formatDate(updated_at_moment)}</span>
                </p>
                <p class="text-gray-300 text-sm mb-3 line-clamp-2">${escapeHtml(description) || '<span class="italic text-gray-500">No description.</span>'}</p>
                <div class="flex flex-wrap gap-1">
                     ${formatTags(tags, 6, '--tag-bg: #374151;')}
                </div>
            </div>
        </div>
    </div>`;
}

 function createTemplateTableRow(template) {
     const { id, name, severity, type, author, tags, updated_at_moment, path, statusFlags } = template;
     const isFavorite = appState.favorites.includes(id);
     const rowId = `row-${escapeHtml(id)}`;

     return `
    <tr id="${rowId}" class="template-table-row hover:bg-gray-800 transition-colors duration-150 cursor-pointer" data-id="${escapeHtml(id)}">
        <td class="px-6 py-3 whitespace-nowrap">
             <div class="flex items-center">
                <div class="overflow-hidden">
                    <div class="text-sm font-medium text-white truncate" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
                </div>
             </div>
        </td>
        <td class="px-6 py-3 whitespace-nowrap">
            <div class="text-sm text-gray-300 font-mono truncate" title="${escapeHtml(id)}">${escapeHtml(id)}</div>
        </td>
        <td class="px-6 py-3 whitespace-nowrap">
             <div class="flex items-center gap-1.5">
                 ${getSeverityBadge(severity, 'small')}
                 ${getStatusIcons(statusFlags)}
             </div>
        </td>
        <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-300">${escapeHtml(type)}</td>
        <td class="px-6 py-3 max-w-xs">
            <div class="flex flex-wrap gap-1">
                ${formatTags(tags, 3, '--tag-bg: #374151; font-size: 0.7rem; padding: 0.1rem 0.4rem;')}
            </div>
        </td>
        <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-300 truncate">
            ${formatAuthors(author, 2)}
        </td>
        <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-300" title="${formatAbsoluteDate(updated_at_moment)}">
            ${formatDate(updated_at_moment)}
        </td>
         <td class="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
             <div class="flex justify-end items-center space-x-3">
                 ${getFavoriteButtonHTML(id, isFavorite)}
                 <button class="copy-id-button text-gray-400 hover:text-white transition-colors p-1 rounded" data-id="${escapeHtml(id)}" title="Copy Template ID">
                     <i class="far fa-copy"></i>
                 </button>
                  <button class="github-button text-gray-400 hover:text-white transition-colors p-1 rounded ${!path ? 'opacity-30 cursor-not-allowed' : ''}" data-id="${escapeHtml(id)}" title="${path ? 'View on GitHub' : 'GitHub path not available'}" ${!path ? 'disabled' : ''}>
                     <i class="fab fa-github"></i>
                 </button>
             </div>
        </td>
    </tr>`;
 }

 function setViewMode(mode, shouldUpdateDisplay = true) {
    if (!['grid', 'list', 'table'].includes(mode)) mode = DEFAULT_VIEW_MODE;
    appState.viewMode = mode;

    gridView.classList.add('hidden');
    listView.classList.add('hidden');
    tableView.classList.add('hidden');

    [gridViewBtn, listViewBtn, tableViewBtn].forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700', 'text-white');
        btn.classList.add('bg-gray-800', 'hover:bg-gray-700', 'text-gray-300');
    });

    const btnMap = { grid: gridViewBtn, list: listViewBtn, table: tableViewBtn };
    const viewMap = { grid: gridView, list: listView, table: tableView };

    if (viewMap[mode]) {
        viewMap[mode].classList.remove('hidden');
    }
    if (btnMap[mode]) {
        btnMap[mode].classList.remove('bg-gray-800', 'hover:bg-gray-700', 'text-gray-300');
        btnMap[mode].classList.add('bg-indigo-600', 'hover:bg-indigo-700', 'text-white');
    }

    saveStateToLocalStorage();

    if (shouldUpdateDisplay) {
         updateDisplay();
    }
 }

 function setDarkMode(isDark) {
     appState.darkMode = isDark;
     const htmlElement = document.documentElement;
     const bodyElement = document.body;

     if (isDark) {
         htmlElement.classList.add('dark');
         bodyElement.classList.add('dark');
         themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
         themeToggle.title = "Switch to Light Mode";
         $('link[href*="highlight.js"]').setAttribute('href', 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/atom-one-dark.min.css');
     } else {
         htmlElement.classList.remove('dark');
         bodyElement.classList.remove('dark');
         themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
         themeToggle.title = "Switch to Dark Mode";
         $('link[href*="highlight.js"]').setAttribute('href', 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/atom-one-light.min.css');

     }

     if (!templateModal.classList.contains('hidden') && currentModalTemplateId) {
         const codeBlock = templateModal.querySelector('#modal-code-container code');
         if (codeBlock) {
            const template = allTemplates.find(t => t.id === currentModalTemplateId);
             if (template && codeBlock) {
                codeBlock.textContent = template.raw_content || '# YAML content not available';
                hljs.highlightElement(codeBlock);
            }
         }
     }

     saveStateToLocalStorage();

     if (chartInstance) {
         const textColor = isDark ? '#d1d5db' : '#374151';
         chartInstance.options.plugins.legend.labels.color = textColor;
         chartInstance.options.plugins.tooltip.titleColor = isDark ? '#ffffff' : '#111827';
         chartInstance.options.plugins.tooltip.bodyColor = textColor;
         chartInstance.options.plugins.tooltip.backgroundColor = isDark ? '#1f2937' : '#ffffff';
         chartInstance.options.plugins.tooltip.borderColor = isDark ? '#4b5563' : '#d1d5db';
         $('#chart-total-count').style.color = isDark ? '#ffffff' : '#1f2937';
         $('#chart-center-text').children[1].style.color = isDark ? '#9ca3af' : '#6b7280';

         chartInstance.update();
     }
 }

function updateResultCounts(startIndex, count, totalFiltered) {
     const startNum = totalFiltered > 0 ? startIndex + 1 : 0;
     const endNum = startIndex + count;
     if (showingCountEl) showingCountEl.textContent = startNum.toLocaleString();
     if (showingToCountEl) showingToCountEl.textContent = 14;
     if (totalCountEl) totalCountEl.textContent = totalFiltered.toLocaleString();
}

 function updatePaginationControls(totalPages) {
    if (!paginationControls) return;

    currentPageEl.textContent = appState.currentPage.toLocaleString();
    totalPagesEl.textContent = totalPages.toLocaleString();

    $('#first-page').disabled = appState.currentPage === 1;
    $('#prev-page').disabled = appState.currentPage === 1;
    $('#next-page').disabled = appState.currentPage === totalPages;
    $('#last-page').disabled = appState.currentPage === totalPages;

    paginationControls.style.display = totalPages <= 1 ? 'none' : 'flex';
 }

function updateSortOrderButtonIcon() {
     sortOrderBtn.innerHTML = appState.sortOrder === 'desc'
         ? '<i class="fas fa-sort-amount-down"></i>'
         : '<i class="fas fa-sort-amount-up"></i>';
     sortOrderBtn.title = `Sort Order: ${appState.sortOrder === 'desc' ? 'Descending' : 'Ascending'}`;
     sortOrderBtn.querySelector('i').classList.add(appState.darkMode ? 'text-white' : 'text-gray-700');
}

 function updateFilterIndicator() {
    const filters = appState.filters;
    const statusFlags = filters.statusFlags;
    const isActive = filters.search || filters.severity.length > 0 || filters.type || filters.author || filters.tags.length > 0 || filters.favoritesOnly || statusFlags.is_draft !== null || statusFlags.is_early !== null || statusFlags.is_new !== null;
    filterIndicator.classList.toggle('hidden', !isActive);
}

function populateFilters() {
    if (!allTemplates || allTemplates.length === 0) {
         console.warn("PopulateFilters: No templates available.");
         severityFilterButtonsContainer.innerHTML = '<p class="text-xs text-gray-500 italic">No severities found.</p>';
         typeFilterSelect.innerHTML = '<option value="">All Types</option><option disabled>No types found</option>';
         authorFilterSelect.innerHTML = '<option value="">All Authors</option><option disabled>No authors found</option>';
         return;
    }

    const authors = new Set();
    const types = new Set();
    const severities = new Set();
    const tags = new Map();

    allTemplates.forEach(t => {
        t.author?.forEach(a => authors.add(a));
        if (t.type && t.type !== 'unknown') types.add(t.type);
        severities.add(t.severity);
         t.tags?.forEach(tag => {
             const lowerTag = tag.toLowerCase();
             tags.set(lowerTag, (tags.get(lowerTag) || 0) + 1);
         });
    });

     const sortedAuthors = [...authors].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
     authorFilterSelect.innerHTML = '<option value="">All Authors</option>' +
        sortedAuthors.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
     authorFilterSelect.disabled = false;

     const sortedTypes = [...types].sort();
     typeFilterSelect.innerHTML = '<option value="">All Types</option>' +
        sortedTypes.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t.charAt(0).toUpperCase() + t.slice(1))}</option>`).join('');
     typeFilterSelect.disabled = false;

     const severityOrderKeys = Object.keys(SEVERITY_ORDER).sort((a, b) => SEVERITY_ORDER[b] - SEVERITY_ORDER[a]);
     severityFilterButtonsContainer.innerHTML = severityOrderKeys
         .filter(s => severities.has(s))
         .map(s => `
             <button class="severity-filter px-3 py-1.5 rounded-md text-sm font-medium border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-all flex items-center gap-1.5 whitespace-nowrap" data-severity="${s}">
                 <span class="w-2.5 h-2.5 inline-block rounded-full border border-gray-600" style="background-color: ${SEVERITY_COLORS[s] || '#ccc'}"></span>
                 ${s.charAt(0).toUpperCase() + s.slice(1)}
             </button>
         `).join('');

     $$('.severity-filter').forEach(button => {
         button.addEventListener('click', handleSeverityFilterClick);
     });

     const sortedTags = [...tags.entries()].sort(([, countA], [, countB]) => countB - countA);
     const topTagsList = $('#top-tags-list');
     if(topTagsList) {
         if (sortedTags.length > 0) {
             topTagsList.innerHTML = sortedTags.slice(0, 7).map(([tag, count]) => `
                 <div class="flex justify-between items-center text-sm hover:bg-gray-700 px-1 rounded cursor-pointer tag-link" data-tag="${escapeHtml(tag)}">
                     <span class="text-gray-300 truncate" title="${escapeHtml(tag)}">${escapeHtml(tag)}</span>
                     <span class="text-indigo-400 font-medium flex-shrink-0 ml-2">${count.toLocaleString()}</span>
                 </div>
             `).join('');
             $$('#top-tags-list .tag-link').forEach(link => {
                link.addEventListener('click', (e) => {
                     const tag = e.currentTarget.dataset.tag;
                     tagsFilterInput.value = tag;
                     tagsFilterInput.dispatchEvent(new Event('input'));
                 });
             });

         } else {
             topTagsList.innerHTML = '<p class="text-gray-500 text-sm italic">No tags found.</p>';
         }
     }
}

function handleSeverityFilterClick(event) {
    const button = event.currentTarget;
    const severity = button.dataset.severity;
    const index = appState.filters.severity.indexOf(severity);

    if (index > -1) {
        appState.filters.severity.splice(index, 1);
        button.classList.remove('filter-active');
    } else {
        appState.filters.severity.push(severity);
        button.classList.add('filter-active');
    }
    appState.currentPage = 1;
    updateDisplay();
}


 function updateStatistics() {
     if (!allTemplates || allTemplates.length === 0) return {};

     const total = allTemplates.length;
     const counts = Object.keys(SEVERITY_ORDER).reduce((acc, key) => { acc[key] = 0; return acc; }, {});
     const authorCounts = new Map();

     allTemplates.forEach(t => {
         const severity = t.severity;
         counts[severity]++;
         t.author?.forEach(a => authorCounts.set(a, (authorCounts.get(a) || 0) + 1));
     });

     $('#stat-total-templates').textContent = total.toLocaleString();
     $('#stat-critical-count').textContent = counts.critical.toLocaleString();
     $('#stat-high-count').textContent = counts.high.toLocaleString();
     $('#stat-medium-count').textContent = counts.medium.toLocaleString();

     const calcPercent = (count) => total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
     $('#stat-critical-percentage').textContent = calcPercent(counts.critical);
     $('#stat-high-percentage').textContent = calcPercent(counts.high);
     $('#stat-medium-percentage').textContent = calcPercent(counts.medium);

     const sortedAuthors = [...authorCounts.entries()].sort(([, countA], [, countB]) => countB - countA);
     const topAuthorsList = $('#top-authors-list');
     if (topAuthorsList) {
         if (sortedAuthors.length > 0) {
             topAuthorsList.innerHTML = sortedAuthors.slice(0, 10).map(([author, count]) => `
                 <div class="flex justify-between items-center text-sm hover:bg-gray-700 px-1 rounded cursor-pointer author-link" data-author="${escapeHtml(author)}">
                     <span class="text-gray-300 truncate" title="${escapeHtml(author)}">${escapeHtml(author)}</span>
                     <span class="text-indigo-400 font-medium flex-shrink-0 ml-2">${count.toLocaleString()}</span>
                 </div>
             `).join('');
             $$('#top-authors-list .author-link').forEach(link => {
                 link.addEventListener('click', (e) => {
                     const author = e.currentTarget.dataset.author;
                     authorFilterSelect.value = author;
                     authorFilterSelect.dispatchEvent(new Event('change'));
                 });
             });
         } else {
             topAuthorsList.innerHTML = '<p class="text-gray-500 text-sm italic">No authors found.</p>';
         }
     }

     return counts;
 }

function initCharts() {
     const severityCounts = updateStatistics();
     const totalCount = allTemplates.length;

     const chartLabels = Object.keys(SEVERITY_ORDER).sort((a, b) => SEVERITY_ORDER[b] - SEVERITY_ORDER[a]);
     const chartDataValues = chartLabels.map(label => severityCounts[label] || 0);
     const chartBackgroundColors = chartLabels.map(label => SEVERITY_COLORS[label] || '#cccccc');

     const chartData = {
         labels: chartLabels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
         datasets: [{
             data: chartDataValues,
             backgroundColor: chartBackgroundColors,
             borderColor: appState.darkMode ? '#1f2937' : '#ffffff',
             borderWidth: 2,
             hoverOffset: 8
         }]
     };

     const legendContainer = $('#severity-legend');
     if (legendContainer) {
         legendContainer.innerHTML = chartLabels.map((label, index) => {
            const count = chartDataValues[index];
            if (count === 0) return '';
            return `
                <div class="flex items-center">
                    <span class="w-3 h-3 rounded-full mr-1.5 flex-shrink-0" style="background-color: ${chartBackgroundColors[index]}"></span>
                    <span class="text-sm text-gray-300">${label.charAt(0).toUpperCase() + label.slice(1)}: ${count.toLocaleString()}</span>
                </div>
            `;
         }).join('');
     }

     $('#chart-total-count').textContent = totalCount.toLocaleString();

     const ctx = $('#severity-chart')?.getContext('2d');
     if (!ctx) {
         console.warn("Severity chart canvas not found");
         return;
     }

     if (chartInstance) {
         chartInstance.destroy();
         chartInstance = null;
     }

     const isDark = appState.darkMode;
     const textColor = isDark ? '#d1d5db' : '#374151';

     chartInstance = new Chart(ctx, {
         type: 'doughnut',
         data: chartData,
         options: {
             responsive: true,
             maintainAspectRatio: false,
             cutout: '70%',
             plugins: {
                 legend: { display: false },
                 tooltip: {
                     enabled: true,
                     backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                     titleColor: isDark ? '#ffffff' : '#111827',
                     bodyColor: textColor,
                     borderColor: isDark ? '#4b5563' : '#d1d5db',
                     borderWidth: 1,
                     padding: 10,
                     boxPadding: 4,
                     cornerRadius: 4,
                     usePointStyle: true,
                     callbacks: {
                         label: function(context) {
                             const label = context.label || '';
                             const value = context.raw || 0;
                             const total = context.dataset.data.reduce((a, b) => a + b, 0);
                             const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                             return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                         },
                         labelPointStyle: function(context) {
                              return { pointStyle: 'rectRounded', rotation: 0 };
                          }
                     }
                 }
             },
             animation: { animateScale: true, animateRotate: true }
         }
     });
}

let currentModalTemplateId = null;

function openTemplateModal(templateId) {
     const template = allTemplates.find(t => t.id === templateId);
     if (!template) {
         showToast('Error', `Template data not found for ID: ${templateId}`, 'error');
         console.error(`Template data not found for ID: ${templateId}`);
         return;
     }
     currentModalTemplateId = templateId;
     console.log("Opening modal for:", templateId, template);

     $('#modal-title').textContent = template.name;
     $('#modal-severity-badge').innerHTML = getSeverityBadge(template.severity);
     $('#modal-status-icon').innerHTML = getStatusIcons(template.statusFlags);

     $('#modal-info-id').textContent = template.id;
     $('#modal-info-author').innerHTML = template.author?.join(', ') || '<span class="italic text-gray-500">Unknown</span>';
     $('#modal-info-type').innerHTML = template.type ? template.type.charAt(0).toUpperCase() + template.type.slice(1) : '<span class="italic text-gray-500">Unknown</span>';
     $('#modal-info-created').textContent = formatAbsoluteDate(template.created_at_moment);
     $('#modal-info-updated').textContent = formatAbsoluteDate(template.updated_at_moment);
     $('#modal-info-status').innerHTML = template.statusFlags.length > 0
        ? template.statusFlags.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')
        : ' <span class="italic text-gray-500">N/A</span>';
     $('#modal-info-path').innerHTML = template.path || '<span class="italic text-gray-500">N/A</span>';


     const classification = template.classification;
     const cveContainer = $('#modal-cve-info-container');
     const hasClassificationInfo = classification && (classification['cve-id'] || classification['cvss-score'] || classification['cwe-id']);

     if (hasClassificationInfo) {
         cveContainer.style.display = 'block';
         const cveIdArray = Array.isArray(classification['cve-id']) ? classification['cve-id'] : [classification['cve-id']].filter(Boolean);
         const cweIdArray = Array.isArray(classification['cwe-id']) ? classification['cwe-id'] : [classification['cwe-id']].filter(Boolean);

         $('#modal-cve-id').innerHTML = cveIdArray.length > 0 ? cveIdArray.map(id => escapeHtml(id)).join(', ') : 'N/A';
         $('#modal-cwe-id').innerHTML = cweIdArray.length > 0 ? cweIdArray.map(id => escapeHtml(id)).join(', ') : 'N/A';

         const score = parseFloat(classification['cvss-score']) || 0;
         const scoreEl = $('#modal-cvss-score');
         const scoreContainer = $('#modal-cvss-score-container');

         if (score > 0) {
             scoreContainer.style.display = 'flex';
             scoreEl.textContent = score.toFixed(1);
             let scoreColor = SEVERITY_COLORS.unknown;
             if (score >= 9.0) scoreColor = SEVERITY_COLORS.critical;
             else if (score >= 7.0) scoreColor = SEVERITY_COLORS.high;
             else if (score >= 4.0) scoreColor = SEVERITY_COLORS.medium;
             else if (score >= 0.1) scoreColor = SEVERITY_COLORS.low;
             scoreEl.style.color = scoreColor;

             $('#modal-cvss-severity').textContent = classification['cvss-severity'] || calculateCvssSeverity(score);
             $('#modal-cvss-vector').textContent = classification['cvss-metrics'] || 'N/A';
         } else {
              scoreContainer.style.display = 'none';
              $('#modal-cvss-vector').textContent = 'N/A';
         }

     } else {
         cveContainer.style.display = 'none';
     }

     $('#modal-tags').innerHTML = formatTags(template.tags, 100, '--tag-bg: #374151;');

     const referencesHtml = template.references?.map(ref => {
        let displayRef = escapeHtml(ref);
        let truncatedRef = displayRef.length > 60 ? displayRef.substring(0, 57) + '...' : displayRef;
        let href = ref.startsWith('http://') || ref.startsWith('https://') ? ref : '#';
        return `
            <li>
                <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center group text-sm break-all" title="${displayRef}">
                   ${href !== '#' ? '<i class="fas fa-external-link-alt mr-1.5 text-xs opacity-70"></i>' : ''}
                   <span>${truncatedRef}</span>
                </a>
            </li>`;
        }).join('') || '<li class="text-sm text-gray-500 italic">No references provided.</li>';
     $('#modal-references').innerHTML = referencesHtml;

     const metadataContainer = $('#modal-metadata-container');
     const metadataEl = $('#modal-metadata');
     const metadata = template.metadata;
     if (metadata && Object.keys(metadata).length > 0) {
         metadataContainer.style.display = 'block';
         metadataEl.innerHTML = Object.entries(metadata).map(([key, value]) =>
             `<div class="mb-1 border-b border-gray-700 pb-1"><strong class="text-gray-400 font-medium">${escapeHtml(key)}:</strong> <span class="text-white break-words">${escapeHtml(value)}</span></div>`
         ).join('');
     } else {
          metadataContainer.style.display = 'none';
     }

     const descriptionText = escapeHtml(template.description || '<span class="italic text-gray-500">No description available.</span>');
     $('#modal-description').innerHTML = descriptionText.replace(/\n/g, '<br>');

     const codeBlock = templateModal.querySelector('#modal-code-container code');
     if (codeBlock) {
         codeBlock.textContent = template.raw_content || '# YAML content not available in templates.json';
         try {
             hljs.highlightElement(codeBlock);
         } catch (e) {
             console.error("Highlight.js error:", e);
             codeBlock.textContent = "# Error highlighting YAML content.\n" + template.raw_content;
         }
         codeBlock.parentElement.scrollTop = 0;
     }


     updateModalActionButtons(template.id, template.path);

     templateModal.classList.remove('hidden');
     document.body.classList.add('overflow-hidden');
     modalClose.focus();
}

 function closeTemplateModal() {
     templateModal.classList.add('hidden');
     currentModalTemplateId = null;
     document.body.classList.remove('overflow-hidden');
 }

 function calculateCvssSeverity(score) {
     score = parseFloat(score);
     if (isNaN(score)) return 'Unknown';
     if (score >= 9.0) return 'Critical';
     if (score >= 7.0) return 'High';
     if (score >= 4.0) return 'Medium';
     if (score >= 0.1) return 'Low';
     return 'None';
 }

 function updateModalActionButtons(templateId, templatePath) {
    const favBtn = $('#modal-favorite-btn');
    const isFav = appState.favorites.includes(templateId);
    const favIcon = favBtn.querySelector('i');
    const favText = favBtn.querySelector('.modal-fav-text');
    if (favIcon) favIcon.className = isFav ? 'fas fa-star mr-2' : 'far fa-star mr-2';
    if (favText) favText.textContent = isFav ? 'Remove Favorite' : 'Add to Favorites';
    favBtn.classList.toggle('favorite-active', isFav);

     const githubBtn = $('#modal-github-btn');
     const githubBaseUrl = 'https://github.com/'; // Adjust if needed
     const githubLink = templatePath ? `${templatePath}` : null;
     if (githubLink) {
         githubBtn.disabled = false;
         githubBtn.onclick = () => window.open(githubLink, '_blank', 'noopener,noreferrer');
         githubBtn.classList.remove('opacity-50', 'cursor-not-allowed');
         githubBtn.title = `View ${templatePath} on GitHub`;
     } else {
         githubBtn.disabled = true;
         githubBtn.onclick = null;
         githubBtn.classList.add('opacity-50', 'cursor-not-allowed');
         githubBtn.title = 'GitHub path not available';
     }

     const downloadBtn = $('#modal-download-btn');
     downloadBtn.onclick = () => downloadTemplate(templateId);
     downloadBtn.disabled = false;
 }

function toggleFavorite(templateId) {

    if (!templateId) return;
    const currTemplate = allTemplates.find(t => t.id === templateId)
    // currTemplate.path = (GITHUB_BASE_URL + currTemplate?.ref.replace(':', '/blob/') + '/' +  currTemplate?.uri)
    const index = appState.favorites.indexOf(templateId);
    let favorited = false;

    if (index > -1) {
        appState.favorites.splice(index, 1);
        showToast('Removed from Favorites', `${templateId}`);
        favorited = false;
    } else {
        appState.favorites.push(templateId);
         showToast('Added to Favorites', `${templateId}`);
         favorited = true;
    }
     saveStateToLocalStorage();
     updateFavoritesFilterButton();

     const itemElement = $(`#card-${templateId}, #list-item-${templateId}, #row-${templateId}`);
     if (itemElement) {
         const favButton = itemElement.querySelector('.favorite-button');
         if (favButton) updateFavoriteButtonState(favButton, favorited);
     }

     if (!templateModal.classList.contains('hidden') && currentModalTemplateId === templateId) {
         updateModalActionButtons(templateId, currTemplate?.path);
     }

     if (appState.filters.favoritesOnly) {
         updateDisplay();
     }
}

function resetFilters() {
     appState.filters = {
        search: '', severity: [], type: '', author: '', tags: [],
        statusFlags: { is_early: null, is_new: null, is_draft: null, is_github: null, is_pdresearch: null, is_pdteam: null, is_pdtemplate: null },
        favoritesOnly: false
     };
     appState.currentPage = 1;

     globalSearchInput.value = '';
     typeFilterSelect.value = '';
     authorFilterSelect.value = '';
     tagsFilterInput.value = '';
     $$('.severity-filter.filter-active').forEach(b => b.classList.remove('filter-active'));
     favoritesBtn.classList.remove('filter-active');
     updateFavoritesFilterButton();

     updateDisplay();
     showToast('Filters Reset', 'Showing all templates.');
}

async function copyToClipboard(text, type = 'Text') {
    if (!text) {
         showToast('Copy Failed', `${type} is empty.`, 'error');
         return;
    }
    try {
        await navigator.clipboard.writeText(text);
        showToast(`${type} Copied`, `Copied to clipboard.`);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
         showToast('Copy Failed', `Could not copy: ${err.message}`, 'error');
    }
}

function downloadTemplate(templateId) {
     const template = allTemplates.find(t => t.id === templateId);
     if (!template || !template.raw_content) {
         showToast('Download Failed', 'Template content is not available.', 'error');
         return;
     }

     let filename = "template.yaml";
     if (template.path) {
        filename = template.path.substring(template.path.lastIndexOf('/') + 1)
                                 .replace(/[^a-z0-9._-]/gi, '_') || `${template.id}.yaml`;
     } else {
         filename = `${template.id.replace(/[^a-z0-9._-]/gi, '_')}.yaml`;
     }
     if (!filename.toLowerCase().endsWith('.yaml')) {
         filename += '.yaml';
     }


     const blob = new Blob([template.raw_content], { type: 'text/yaml;charset=utf-8' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.style.display = 'none';
     a.href = url;
     a.download = filename;
     document.body.appendChild(a);
     a.click();
     window.URL.revokeObjectURL(url);
     document.body.removeChild(a);

     showToast('Download Started', `Downloading ${filename}`);
}

function exportVisibleToJson() {
     if (filteredTemplates.length === 0) {
         showToast('Export Failed', 'No templates are currently visible to export.', 'warning');
         return;
     }

     const templatesToExport = filteredTemplates.map(t => {
         const { created_at_moment, updated_at_moment, statusFlags, ...rest } = t;
         return rest;
     });

     const blob = new Blob([JSON.stringify(templatesToExport, null, 2)], { type: 'application/json;charset=utf-8' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.style.display = 'none';
     a.href = url;
     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
     a.download = `nuclei-templates-export-${timestamp}.json`;
     document.body.appendChild(a);
     a.click();
     window.URL.revokeObjectURL(url);
     document.body.removeChild(a);
     showToast('Export Started', `Exporting ${filteredTemplates.length} templates.`);
}

 function viewOnGitHub(templateId) {
     const template = allTemplates.find(t => t.id === templateId);
     const path = template?.path;
     if (path) {
         window.open(path, '_blank', 'noopener,noreferrer');
     } else {
         showToast('Cannot View on GitHub', 'Template path information is not available.', 'warning');
     }
 }

let toastTimeoutId = null;
function showToast(message, description = '', type = 'success', duration = 4000) {
    toastMessage.textContent = message;
    toastDescription.textContent = description;
    toastDescription.style.display = description ? 'block' : 'none';

    if (toastTimeoutId) clearTimeout(toastTimeoutId);

     let iconClass = 'fa-check-circle';
     let iconColorClass = 'text-green-400';
     if (type === 'error') {
         iconClass = 'fa-times-circle'; iconColorClass = 'text-red-500';
     } else if (type === 'warning') {
         iconClass = 'fa-exclamation-triangle'; iconColorClass = 'text-yellow-500';
     } else if (type === 'info') {
         iconClass = 'fa-info-circle'; iconColorClass = 'text-blue-400';
     }

     toastIcon.innerHTML = `<i class="fas ${iconClass} text-xl ${iconColorClass}"></i>`;

     toast.classList.remove('translate-y-[200%]', 'opacity-0');
     toast.classList.add('translate-y-0', 'opacity-100');

     toastTimeoutId = setTimeout(() => {
         hideToast();
     }, duration);
}

function hideToast() {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-[200%]', 'opacity-0');
    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
    }
}


 function updateFavoritesFilterButton() {
     const isFavFilterActive = appState.filters.favoritesOnly;
     favoritesBtn.classList.toggle('filter-active', isFavFilterActive);
     const icon = favoritesBtn.querySelector('i');
     if (icon) {
         icon.className = isFavFilterActive
             ? 'fas fa-star text-yellow-400 mr-2'
             : 'fas fa-star text-gray-400 mr-2';
     }
 }

function setupEventListeners() {
    gridViewBtn.addEventListener('click', () => setViewMode('grid'));
    listViewBtn.addEventListener('click', () => setViewMode('list'));
    tableViewBtn.addEventListener('click', () => setViewMode('table'));

    settingsButton.addEventListener('click', () => {
         settingsPanel.classList.remove('translate-x-full');
         settingsBackdrop.classList.remove('hidden');
    });
    const closeSettings = () => {
         settingsPanel.classList.add('translate-x-full');
         settingsBackdrop.classList.add('hidden');
     };
    settingsClose.addEventListener('click', closeSettings);
    settingsBackdrop.addEventListener('click', closeSettings);

     settingDarkModeToggle.addEventListener('change', (e) => setDarkMode(e.target.checked));
     settingReloadBtn.addEventListener('click', () => window.location.reload());
     settingClearFavoritesBtn.addEventListener('click', () => {
         Swal.fire({
             title: 'Clear All Favorites?', text: "This action cannot be undone.", icon: 'warning',
             showCancelButton: true, confirmButtonColor: '#eab308', cancelButtonColor: '#6b7280',
             confirmButtonText: 'Yes, clear them!', background: appState.darkMode ? '#1f2937' : '#f9fafb',
             color: appState.darkMode ? '#ffffff' : '#111827', customClass: { popup: 'rounded-xl' }
         }).then((result) => {
             if (result.isConfirmed) {
                 appState.favorites = [];
                 saveStateToLocalStorage();
                 updateFavoritesFilterButton();
                 $$('.favorite-button').forEach(btn => updateFavoriteButtonState(btn, false));
                 if (appState.filters.favoritesOnly) updateDisplay();
                 showToast('Favorites Cleared', 'All favorites removed.', 'info');
             }
         })
     });
      settingClearStorageBtn.addEventListener('click', () => {
         Swal.fire({
             title: 'Clear All Local Data?', html: "This removes <strong>favorites</strong> AND <strong>saved settings</strong>.<br>The page will reload.",
             icon: 'error', iconColor: '#ef4444', showCancelButton: true, confirmButtonColor: '#dc2626',
             cancelButtonColor: '#6b7280', confirmButtonText: 'Yes, clear everything!',
             background: appState.darkMode ? '#1f2937' : '#f9fafb', color: appState.darkMode ? '#ffffff' : '#111827',
             customClass: { popup: 'rounded-xl' }
         }).then((result) => {
             if (result.isConfirmed) {
                 clearLocalStorage();
                 showToast('Local Data Cleared', 'Reloading page...', 'info', 2000);
                 setTimeout(() => window.location.reload(), 2100);
             }
         })
     });

    modalClose.addEventListener('click', closeTemplateModal);
    document.addEventListener('click', (e) => {
         if (e.target.classList.contains('modal-bg-close')) {
             closeTemplateModal();
             helpModal.classList.add('hidden');
             repoModal.classList.toggle('hidden')
             if (!settingsPanel.classList.contains('translate-x-full')) {
                 closeSettings();
             }
             document.body.classList.remove('overflow-hidden');
         }
     });
     $('#modal-favorite-btn').addEventListener('click', () => toggleFavorite(currentModalTemplateId));
     $('#modal-copy-id-btn').addEventListener('click', () => copyToClipboard(currentModalTemplateId, 'Template ID'));
     $('#modal-copy-code-btn').addEventListener('click', () => {
         const template = allTemplates.find(t => t.id === currentModalTemplateId);
         copyToClipboard(template?.raw_content || '', 'Template Code');
     });

    helpButton.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    });

    remoteRepoBtn.addEventListener('click', () => {
        repoModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
     });

    themeToggle.addEventListener('click', () => setDarkMode(!appState.darkMode));

    toastClose.addEventListener('click', hideToast);

    globalSearchInput.addEventListener('input', debounce(() => {
        appState.filters.search = globalSearchInput.value.trim();
        appState.currentPage = 1;
        updateDisplay();
    }, 300));

    typeFilterSelect.addEventListener('change', () => {
        appState.filters.type = typeFilterSelect.value;
        appState.currentPage = 1;
        updateDisplay();
    });

     authorFilterSelect.addEventListener('change', () => {
        appState.filters.author = authorFilterSelect.value;
        appState.currentPage = 1;
        updateDisplay();
    });

     tagsFilterInput.addEventListener('input', debounce(() => {
         appState.filters.tags = tagsFilterInput.value
            .split(',')
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag);
        appState.currentPage = 1;
        updateDisplay();
     }, 400));

     favoritesBtn.addEventListener('click', () => {
         appState.filters.favoritesOnly = !appState.filters.favoritesOnly;
         appState.currentPage = 1;
         updateFavoritesFilterButton();
         updateDisplay();
     });

     resetFiltersBtn.addEventListener('click', resetFilters);
     exportJsonBtn.addEventListener('click', exportVisibleToJson);

     sortBySelect.addEventListener('change', () => {
         appState.sortBy = sortBySelect.value;
         updateDisplay();
         saveStateToLocalStorage();
     });
     sortOrderBtn.addEventListener('click', () => {
         appState.sortOrder = appState.sortOrder === 'desc' ? 'asc' : 'desc';
         updateSortOrderButtonIcon();
         updateDisplay();
         saveStateToLocalStorage();
     });

    perPageSelect.addEventListener('change', () => {
        appState.pageSize = parseInt(perPageSelect.value, 10) || DEFAULT_PAGE_SIZE;
        appState.currentPage = 1;
        updateDisplay();
        saveStateToLocalStorage();
    });
    $('#first-page').addEventListener('click', () => { if (appState.currentPage !== 1) { appState.currentPage = 1; updateDisplay(); } });
    $('#prev-page').addEventListener('click', () => { if (appState.currentPage > 1) { appState.currentPage--; updateDisplay(); } });
    $('#next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredTemplates.length / appState.pageSize) || 1;
        if (appState.currentPage < totalPages) { appState.currentPage++; updateDisplay(); }
    });
     $('#last-page').addEventListener('click', () => {
         const totalPages = Math.ceil(filteredTemplates.length / appState.pageSize) || 1;
         if (appState.currentPage !== totalPages) { appState.currentPage = totalPages; updateDisplay(); }
     });

    document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
     const activeElement = document.activeElement;
     const isInputFocused = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);

    if (e.key === 'Escape') {
        if (!templateModal.classList.contains('hidden')) {
            closeTemplateModal();
        } else if (!helpModal.classList.contains('hidden')) {
            helpModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        } else if (!repoModal.classList.contains('hidden')) {
             repoModal.classList.add('hidden');
             document.body.classList.remove('overflow-hidden');
        } else if (!settingsPanel.classList.contains('translate-x-full')) {
             settingsClose.click();
        }
        return;
    }

     if (!isInputFocused) {
         if (e.key === 'ArrowLeft') {
             e.preventDefault();
             $('#prev-page').click();
         } else if (e.key === 'ArrowRight') {
             e.preventDefault();
             $('#next-page').click();
         }

         if (e.altKey) {
              if (e.key === '1') { e.preventDefault(); setViewMode('grid'); }
              else if (e.key === '2') { e.preventDefault(); setViewMode('list'); }
              else if (e.key === '3') { e.preventDefault(); setViewMode('table'); }
          }
          if (e.key === 't') {
              e.preventDefault();
              themeToggle.click();
          }
          //if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
          //     e.preventDefault();
          //     favoritesBtn.click();
          // }
     }

     if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
         e.preventDefault();
         globalSearchInput.focus();
         globalSearchInput.select();
     }
     if (e.key === '/' && !isInputFocused) {
          e.preventDefault();
          globalSearchInput.focus();
          globalSearchInput.select();
     }

    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
         settingsButton.click();
     }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

 function animateElements() {
    if (typeof anime !== 'undefined') {
         anime({
             targets: '.hover-card-effect', translateY: [10, 0], opacity: [0, 1],
             delay: anime.stagger(60, { start: 100 }), easing: 'easeOutQuad', duration: 500
         });
         anime({
             targets: '.glass-effect', opacity: [0, 1], scale: [0.98, 1],
             delay: 300, easing: 'easeOutSine', duration: 400
         });
         anime({
              targets: 'header > div', translateX: [-20, 0], opacity: [0, 1],
              delay: anime.stagger(100), easing: 'easeOutExpo', duration: 600
         });
    } else {
        console.warn("Anime.js not loaded, skipping animations.");
    }
 }

 function initTooltips() {
     if (typeof tippy !== 'undefined') {
         $$('[data-tippy-root]').forEach(el => el._tippy?.destroy());
         tippy('[title]', {
            content(reference) {
                const title = reference.getAttribute('title');
                return title || '';
            },
            placement: 'top', arrow: true, animation: 'shift-away-subtle',
            theme: 'translucent', allowHTML: true, delay: [150, 0],
            interactive: false, appendTo: () => document.body
         });
     } else {
         console.warn("Tippy.js not loaded, skipping tooltips.");
     }
 }
