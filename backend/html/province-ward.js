// Cascading Address Dropdowns with esgoo.net API
const allProvinces = [];
const provinceCache = {}; // Cache for wards by province ID
window.provincesLoaded = false; // Flag to track if provinces are loaded

// Get all unique province selects - support both patterns: [id$="-province"] and [id^="tinh_"]
const provinceSelects = document.querySelectorAll('[id$="-province"], [id^="tinh_"]');

/**
 * Initialize cascading dropdowns on page load
 */
document.addEventListener('DOMContentLoaded', async function () {
    try {
        await loadAndPopulateProvinces();
        window.provincesLoaded = true; // Mark as loaded

        setupProvinceChangeListeners();

        // Check if there are pending restore values and trigger restoration
        const wardSelects = document.querySelectorAll('[id$="-ward"], [id^="xa_"]');
        wardSelects.forEach(wardSelect => {
            let provinceSelect;

            // Determine province select based on ward select ID pattern
            if (wardSelect.id.includes('-ward')) {
                provinceSelect = document.getElementById(wardSelect.id.replace('-ward', '-province'));
            } else if (wardSelect.id.includes('xa_')) {
                // Extract number from xa_ddkd_1 to get tinh_ddkd_1
                const rowNum = wardSelect.id.match(/\d+$/)[0];
                provinceSelect = document.getElementById('tinh_ddkd_' + rowNum);
            }

            if (provinceSelect && provinceSelect.value) {
                provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
    }
});

/**
 * Load provinces from esgoo.net and populate all province selects
 */
async function loadAndPopulateProvinces() {
    try {
        const response = await fetch('https://esgoo.net/api-tinhthanh-new/1/0.htm');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const provinces = data.data || [];
        allProvinces.push(...provinces); // Store for later reference

        // Populate all province dropdowns
        provinceSelects.forEach(select => {
            // Clear existing options except first
            while (select.options.length > 1) {
                select.remove(1);
            }

            // Add provinces
            provinces.forEach(province => {
                const option = document.createElement('option');
                option.value = province.id;
                option.textContent = province.full_name || province.name;
                select.appendChild(option);
            });
        });

        return true;
    } catch (error) {
        console.error('❌ Failed to load provinces:', error);
        return false;
    }
}

/**
 * Setup change listeners for province dropdowns
 */
function setupProvinceChangeListeners() {
    provinceSelects.forEach(provinceSelect => {
        provinceSelect.addEventListener('change', async (e) => {
            const provinceId = e.target.value;

            // Find corresponding ward select
            const selectId = e.target.id;
            let wardSelect;

            if (selectId.includes('-province')) {
                // Old pattern: address-1-province -> address-1-ward
                const baseId = selectId.replace('-province', '');
                wardSelect = document.getElementById(baseId + '-ward');
            } else if (selectId.includes('tinh_')) {
                // New pattern: tinh_ddkd_1 -> xa_ddkd_1
                const rowNum = selectId.match(/\d+$/)[0];
                wardSelect = document.getElementById('xa_ddkd_' + rowNum);
            }

            if (!wardSelect) return;

            // Reset ward select
            while (wardSelect.options.length > 1) {
                wardSelect.remove(1);
            }
            wardSelect.disabled = !provinceId;

            if (!provinceId) return;

            // Load wards for selected province
            await loadWards(provinceId, wardSelect);
        });
    });
}

/**
 * Load wards/districts for a given province ID
 */
async function loadWards(provinceId, wardSelect) {
    try {
        // Check cache first
        if (provinceCache[provinceId]) {
            populateWardSelect(provinceCache[provinceId], wardSelect);
            return;
        }

        const response = await fetch(`https://esgoo.net/api-tinhthanh-new/2/${provinceId}.htm`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const wards = data.data || [];

        // Cache the wards
        provinceCache[provinceId] = wards;

        // Populate the select
        populateWardSelect(wards, wardSelect);
    } catch (error) {
        console.error('Failed to load wards for province ' + provinceId + ':', error);
    }
}

/**
 * Populate ward select with options
 */
function populateWardSelect(wards, wardSelect) {
    // Clear existing options except first
    while (wardSelect.options.length > 1) {
        wardSelect.remove(1);
    }

    // Add ward options
    wards.forEach(ward => {
        const option = document.createElement('option');
        option.value = ward.id;
        option.textContent = ward.full_name || ward.name;
        wardSelect.appendChild(option);
    });
}

/**
 * Populate a single province select with cached provinces
 * Used when dynamically adding new rows
 */
function populateProvinceSelect(provinceSelect) {
    if (!provinceSelect || allProvinces.length === 0) {
        console.warn('Cannot populate province select - provinces not loaded yet');
        return false;
    }

    // Clear existing options except first
    while (provinceSelect.options.length > 1) {
        provinceSelect.remove(1);
    }

    // Add provinces
    allProvinces.forEach(province => {
        const option = document.createElement('option');
        option.value = province.id;
        option.textContent = province.full_name || province.name;
        provinceSelect.appendChild(option);
    });

    return true;
}
