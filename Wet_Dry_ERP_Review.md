# **Wet & Dry ERP \- System Review**

*Project Review Document*

## **OVERVIEW**

This document outlines the findings from the comprehensive system review of the Wet & Dry ERP application. Items are categorized by priority and organized by module for efficient developer assignment and tracking.

## **PRIORITY LEVELS**

* **CRITICAL: System crashes, blocking errors that prevent core functionality**  
* **HIGH: Major issues affecting user experience or data integrity**  
* **MEDIUM: UI inconsistencies, minor bugs, usability improvements**  
* **LOW: Cosmetic issues, minor text changes**

## **1\. CRITICAL ISSUES**

### **1.1 Fleets Module \- System Crashes**

* **Issue:** Application crashes when adding maintenance records  
* **Error:** "Application error: a server-side exception has occurred while loading wetanddry-erp-v2.vercel.app. Digest: 352762608"  
    
* **Issue:** Application crashes when adding components  
* **Error:** "Application error: a server-side exception has occurred while loading wetanddry-erp-v2.vercel.app. Digest: 352762608"  
    
* **Issue:** Application crashes when scheduling maintenance  
* **Error:** "Application error: a server-side exception has occurred while loading wetanddry-erp-v2.vercel.app. Digest: 615775283"  
    
* **Issue:** Application crashes when uploading documents

* **Error:** "Application error: a server-side exception has occurred while loading wetanddry-erp-v2.vercel.app. Digest: 615775283"


### **1.2 Fuel & Diesel Management \- Core Functionality Missing**

* **Issue:** Unable to add fuel deposits (litres and price per litre)  
* **Action Required:** Implement fuel deposit form with validation for litres and price inputs

### **1.3 Global Search \- Non-functional**

* **Issue:** Global search feature is not working  
* **Action Required:** Decision needed: Fix global search or remove feature entirely?

## **2\. HIGH PRIORITY ISSUES**

### **2.1 Fuel & Diesel Management \- Feature Gaps**

* **Issue:** Fuel issuance limited to trucks only (excludes generators)  
* **Action Required:** Expand fuel issuance to include generators and other equipment  
* **Issue:** No reconciliation system for fuel inventory tracking  
* **Business Case:** When purchasing 1000 litres at NGN1,800/litre and using 900 litres before restocking, system needs to track remaining 100 litres and blended pricing for new deposits  
* **Action Required:** Implement fuel reconciliation module with historical pricing logs and running balance calculations

### **2.2 Inventory \- Stock Out UI Issues**

* **Issue:** Stock Out form layout broken \- cannot submit material requests due to spacing issues  
* **Action Required:** Fix form layout/spacing to enable proper submission

### **2.3 Staff Registry \- Data Persistence Issues**

* **Issue:** Document uploads not saving  
* **Action Required:** Debug file upload handler and verify database storage

### **2.4 Reports Module \- Missing CRM Metrics**

* **Issue:** Reports module not displaying CRM data metrics  
* **Action Required:** Analyze CRM data structure and implement meaningful metrics dashboard (customer acquisition, sales pipeline, conversion rates, etc.)

## **3\. MEDIUM PRIORITY ISSUES**

### **3.1 Orders Module \- UI Outdated**

* **Issue:** "Create New Order" popup using old UI design with black lines  
* **Action Required:** Update popup UI to match current design system

### **3.2 Fleets Module \- UI Inconsistency**

* **Issue:** Search bar design inconsistent with Orders module  
* **Action Required:** Standardize search bar styling across all modules to match Orders design

### **3.3 Staff Registry \- UX Issues**

* **Issue:** After saving staff info with Enter key, page doesn't redirect to records list automatically  
* **Action Required:** Implement auto-redirect after successful save  
* **Issue:** View documents option not practical \- inconsistent with Inventory module  
* **Action Required:** Redesign document viewer to match Inventory's "View Item" functionality for UI consistency

### **3.4 Inventory \- Unclear Feature**

* **Issue:** Stock In \- "Update stored unit cost" checkbox shows confusing message: "Check this if the new price (₦) should replace the current system price for future transactions"  
* **Action Required:** Fix display issue and add tooltip/help text explaining this feature's purpose

### **3.5 CRM Module \- Misplaced Features**

* **Issue:** Expenses and Record Expenses features don't belong in CRM module  
* **Action Required:** Move Expenses functionality to Reports module for better organization  
* **Issue:** Analytics section not focusing on CRM-specific data  
* **Action Required:** Remove Analytics from CRM or reconfigure to show CRM-specific metrics. Consider implementing in future updates if needed.

## **4\. LOW PRIORITY ISSUES**

### **4.1 Login Page \- Branding**

* **Issue:** Login displays "Wet and Dry EMS" instead of "Wet and Dry ERP"  
* **Action Required:** Update text from "EMS" to "ERP"  
* **Issue:** "POWERED BY CYBRIC TECHNOLOGIES" not clickable/linked  
* **Action Required:** Make text clickable and link to Cybric Technologies website "Cybric.tech"

## **5\. MODULES WORKING CORRECTLY ✅**

* Dashboard \- Fully functional  
* CRM \- Clients \- Fully functional  
* Orders \- All functions operational (except UI update needed)  
* Fleets \- Spare Parts \- Fully functional  
* Inventory \- Stock In \- Functional (minor clarity issue)  
* Production \- Perfect  
* Exceptions \- Works fine

## **6\. SUMMARY & RECOMMENDATIONS**

**Total Issues Identified:** 21

* Critical: 6 issues  
* High Priority: 6 issues  
* Medium Priority: 8 issues  
* Low Priority: 3 issues

### **Recommended Action Plan:**

* **Phase 1 (Immediate):** Address all CRITICAL issues \- particularly Fleets module crashes and Fuel Management functionality  
* **Phase 2 :** Resolve HIGH priority items \- focus on data integrity and missing features  
* **Phase 3 :** Clean up MEDIUM priority UI inconsistencies and UX improvements  
* **Phase 4 (As time permits):** Address LOW priority cosmetic issues

**Review Date:** February 15, 2026