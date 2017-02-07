/*************************** Cart Payment Controller ***************************/

App.controller('cartPaymentCtrl', ['$scope', '$rootScope', '$window', '$timeout', '$route', '$filter', '$log', 'filterFilter', 'toaster', 'Cart', 'User', 'Utils', 'Constants','AnalyticsService',
    function ($scope, $rootScope, $window, $timeout, $route, $filter, $log, filterFilter, toaster, Cart, User, Utils, Constants, AnalyticsService) {

    var init = function () {
        // Initialize user obj
        $scope.user = ($rootScope.$persistentStorage.devMode ? angular.copy($rootScope.$persistentStorage.testUser) : {});
        // Initialize payment obj
        if (!$scope.payment) $scope.payment = ($rootScope.$persistentStorage.devMode ? angular.copy($rootScope.$persistentStorage.testPayment) : {});
        // Set empty object for UA vouchers
        $scope.payment.vouchers = $scope.payment.vouchers || $scope.getVoucherFields();
        //Set defaults for ccEmails using existing storage or preset object
        $rootScope.$storage.user.ccEmails = ($rootScope.$storage.user.ccEmails && $rootScope.$storage.user.ccEmails.length) ? $rootScope.$storage.user.ccEmails : [{ id: 0, value: '' }, { id: 1, value: '' }];
        //Config payment
        configPayment();
        if ($scope.paymentRequired) {
            //Get Countries
            $scope.getCountries();
        }
        //Login Listener Ref
        $scope.loginListenerRef = null;
        //Listen for login
        loginListener();
        //Set card pattern types
        setCardTypes();
        //Set initial credit card type if a cardNo exists
        if ($scope.payment.cardNo) $scope.creditCardType = $scope.getCardType();
        if ($rootScope.$storage.user.storedCreditCard) $scope.creditCardLabel = $scope.getCardLabel($rootScope.$storage.user.storedCreditCard.type);
        //Set default useStoredCard to true
        $scope.useStoredCard = true;
        //Set sendNewsletters to true by default
        if (!$rootScope.$storage.kioskMode && !$rootScope.$storage.explorerMode) $rootScope.$storage.user.sendNewsletters = true;
        AnalyticsService.processCheckout({ 'step': 2, 'option': Utils.getChannel() });
        AnalyticsService.sendPageView();
    };

    var configPayment = function () {
        //No payment type established
        $scope.payment.type = null;
        //Payment Required
        $scope.paymentRequired = Cart.paymentRequired();
        //Payment Tab
        $scope.paymentTab = $scope.paymentTab || ($scope.paymentRequired) ? ($rootScope.$storage.isGroupUser) ? 'po' : 'cc' : '';
        //Update tab display
        if ($scope.paymentRequired) $scope.updatePaymentType();
    };

    var setCardTypes = function () {
        $scope.cardPatterns = {  
            visa: new RegExp(Constants.cardTypes.visa.pattern),
            masterCard: new RegExp(Constants.cardTypes.masterCard.pattern),
            amex: new RegExp(Constants.cardTypes.amex.pattern),
            dinersClub: new RegExp(Constants.cardTypes.dinersClub.pattern),
            discover: new RegExp(Constants.cardTypes.discover.pattern),
            jcb: new RegExp(Constants.cardTypes.jcb.pattern)
        };
    };

    var loginListener = function () {
        $scope.loginListenerRef = $rootScope.$on('userLogin', function () {
            init();
        });
    };

    //Payment Modules
    $scope.formModules = {
        contact: { show: true },
        creditCard: { show: false },
        billingAddress: { show: false },
        ccEmails: { show: true },
        ua: { show: false },
        po: { show: false }
    };

    // Submit Order
    $scope.orderSubmit = function () {

        // Post order to API
        Cart.checkout({
            paymentMethod: ($scope.paymentRequired) ? $scope.getPaymentMethod() : null,
            emailAddress: $rootScope.$storage.user.emailAddress,
            sendNewsletters: $rootScope.$storage.user.sendNewsletters,
            firstName: $rootScope.$storage.user.firstName || '[]',
            lastName: $rootScope.$storage.user.lastName || '[]',
            password: $scope.user.password || null,
            address1: $rootScope.$storage.user.address1 || '[]',
            address2: $rootScope.$storage.user.address2 || '[]',
            city: $rootScope.$storage.user.city || '[]',
            stateProvince: ($scope.user.state == '') ? { stateCode: null, name: '' } : $scope.user.state,
            countryId: $scope.user.country || null,
            postalCode: $rootScope.$storage.user.postalCode || '[]',
            ccEmails: $scope.getCCEmails() || [],
            channel: Utils.getChannel()
        });

    };

    // Trigger upsell after zipCode is entered
    $scope.checkForUpsell = function () {
        $timeout(function () {
            if ($rootScope.$storage.user.postalCode && $rootScope.$storage.user.postalCode.length >= 5 && $route.current.$$route.upsell && $route.current.$$route.upsell.breakpoints.indexOf($rootScope.breakpoint) !== -1 && !$rootScope.$persistentStorage.supress.upsell) {
                $rootScope.$broadcast('upsellReady', $route.current.$$route.upsell);
                if ($rootScope.$storage.selectedTicketType.category === 'SuperSaver') {
                    $scope.isSuperSaverFamilyUpsell = true;
                    //Track promotion
                    var ecPromo = { id: $rootScope.$storage.upsell.item.typeName.replaceAll(' ', ''), name: $rootScope.$storage.upsell.item.typeName, creative: 'sidebar' };
                    AnalyticsService.addPromo(ecPromo);
                    AnalyticsService.sendPageView();
                    $rootScope.$storage.upsell.status = 'in progress';
                } else {
                    $scope.isSuperSaverFamilyUpsell = false;
                }
            }else {
                $scope.isSuperSaverFamilyUpsell = false;
            }
        });
    };

    // Continue to checkout
    $scope.continue = function () {
        // Attempt upsell first
        if ($rootScope.$storage.upsell.item && !$rootScope.$storage.explorerMode) {
            // Show upsell slide push
            $rootScope.$storage.upsell.status = 'in progress';
            //Track promotion
            var ecPromo = { id: $rootScope.$storage.upsell.item.typeName.replaceAll(' ', ''), name: $rootScope.$storage.upsell.item.typeName, creative: 'sidebar' };
            AnalyticsService.addPromo(ecPromo);
            AnalyticsService.sendPageView();
            // Increase upsell count IF type is not donation
            if ($rootScope.$storage.upsell.item.typeName != 'Add-On Donation') $rootScope.$storage.upsell.count++;
        }
        // Otherwise submit order
        else $scope.orderSubmit();
    };

    // On Upsell Accept (Sub)
    $scope.$on('upsellAccept', function (event, upsell) {
        if (upsell.cartItemType === 'Membership') Utils.goTo('/memberships/' + upsell.typeId + '/details');
    });

    // On Upsell Deny (Sub)
    $scope.$on('upsellDeny', function () {
        if ($scope.isSuperSaverFamilyUpsell) {
            $scope.$parent.dismiss();
        } else {
            $scope.continue();
        }
    });

    // On total change
    $rootScope.$watch('$storage.cart.total', function () {
        configPayment();
    });

    $scope.$watch('paymentTab', function () {
        $scope.updatePaymentType();
    });

    $rootScope.$watch(function () { return ($rootScope.$storage.user) ? $rootScope.$storage.user.storedCreditCard : false; }, function () {
        if (!$rootScope.$storage.user || !$rootScope.$storage.user.storedCreditCard) return;
        $scope.creditCardLabel = $scope.getCardLabel($rootScope.$storage.user.storedCreditCard.type);
    });

    $scope.cardRequired = function () {
        return ($rootScope.$storage.user.storedCreditCard && !$scope.useStoredCard) || !$rootScope.$storage.user.storedCreditCard;
    };

    // Add CC Field
    $scope.addEmailCC = function () {
        $rootScope.$storage.user.ccEmails.push({ id: $rootScope.$storage.user.ccEmails.length, value: '' });
    };

    // Remove CC Field
    $scope.removeEmailCC = function (index) {
        //If no index, exit
        if(!index) return;
        //Never remove first item or last item 
        if (index < 1 || index >= $rootScope.$storage.user.ccEmails.length - 1) return;
        //Remove from array
        $rootScope.$storage.user.ccEmails.splice(index, 1);
    };

    // Filter duplicates and add to return obj as as an array
    $scope.getCCEmails = function () {
        var obj = [];
        $rootScope.$storage.user.ccEmails = $filter('unique')($rootScope.$storage.user.ccEmails, 'value');
        angular.forEach($rootScope.$storage.user.ccEmails, function (ccEmail) {
            if(ccEmail.value) obj.push(ccEmail.value);
        });
        return obj;
    };

    //Return flat array of vouchers
    $scope.getUAVouchers = function () {
        var obj = [];
        angular.forEach($scope.payment.vouchers, function (voucher) {
            obj.push(voucher.value);
        });
        return obj;
    };

    //Get paymentMethod for credit card manual
    $scope.getManualCreditCardMethod = function () {
        return {
            cardholderName: $rootScope.$storage.user.firstName + ' ' + $rootScope.$storage.user.lastName,
            cardNo: $scope.payment.cardNo || null,
            cardExpiryYear: $scope.payment.cardExpiryYear || null,
            cardExpiryMonth: $scope.payment.cardExpiryMonth || null,
            cardSecurityCode: $scope.payment.cardSecurityCode || null,
            shouldStore: $scope.payment.shouldStore || null,
            cardType: $scope.creditCardType || ''
        }
    };

    // Get  paymentMethod for po
    $scope.getPOMethod = function () {
        return {
            purchaseOrderNumber: $scope.payment.purchaseOrderNumber || null
        };
    };

    // Get  paymentMethod for ua
    $scope.getUAMethod = function () {
        return {
            vouchers: $scope.getUAVouchers() || null
        };
    };

    // Get Payment Method Object
    $scope.getPaymentMethod = function () {

        //If no payment type exists, log the error and return null
        if(!$scope.payment.type) {
            $log.error('$scope.payment.type is invalid in getpaymentMethod()');
            return null;
        }

        var paymentMethod = null;
        //Get payment method object based on current tab
        switch ($scope.paymentTab) {
            case 'po':
                paymentMethod = $scope.getPOMethod();
                break;
            case 'ua':
                paymentMethod = $scope.getUAMethod();
                break;
            case 'cc':
                $scope.payment.type = (!$scope.cardRequired()) ? Constants.order.paymentTypes.ccStored : Constants.order.paymentTypes.ccManual;
                paymentMethod = (!$scope.cardRequired()) ? {} : $scope.getManualCreditCardMethod();
                break;
        };
        //If no payment method object log the error and return null
        if(!paymentMethod) {
            $log.error('paymentMethod not found in getpaymentMethod() in cart-payment.controller.js');
            return null;
        }

        //Merge payment method object into return object
        return angular.extend({
            $type: ($scope.payment.type ? 'AmnhDigital.Ticketing.Entities.' + $scope.payment.type + ', AmnhDigital.Ticketing.Entities' : '')
        }, paymentMethod);

    };

    //Watch for updates to $scope.payment.cardNo and update $scope.creditCardType with matched card type
    $scope.$watch(function () { return $scope.payment.cardNo; }, function (newValue, oldValue) {
        $scope.creditCardType = $scope.getCardType(newValue);
    });

    $scope.getCardType = function (cardNo) {

        var res = '';
        
        if ($scope.cardPatterns.visa.test(cardNo)) {
            res = Constants.cardTypes.visa.value;
        } else if ($scope.cardPatterns.masterCard.test(cardNo)) {
            res = Constants.cardTypes.masterCard.value;
        } else if ($scope.cardPatterns.amex.test(cardNo)) {
            res = Constants.cardTypes.amex.value;
        } else if ($scope.cardPatterns.dinersClub.test(cardNo)) {
            res = Constants.cardTypes.dinersClub.value;
        } else if ($scope.cardPatterns.discover.test(cardNo)) {
            res = Constants.cardTypes.discover.value;
        } else if ($scope.cardPatterns.jcb.test(cardNo)) {
            res = Constants.cardTypes.jcb.value;
        }

        return res;

    };
    
    $scope.getCardLabel = function (cardType) {

        var _cardType = cardType || $rootScope.$storage.user.storedCreditCard.type;
        var ret = '';

        switch (_cardType) {
            case Constants.cardTypes.visa.value:
                ret = Constants.cardTypes.visa.label;
                break;
            case Constants.cardTypes.masterCard.value:
                ret = Constants.cardTypes.masterCard.label;
                break;
            case Constants.cardTypes.amex.value:
                ret = Constants.cardTypes.amex.label;
                break;
            case Constants.cardTypes.dinersClub.value:
                ret = Constants.cardTypes.dinersClub.label;
                break;
            case Constants.cardTypes.discover.value:
                ret = Constants.cardTypes.discover.label;
                break;
            case Constants.cardTypes.jcb.value:
                ret = Constants.cardTypes.jcb.label;
                break;
        }

        return ret;

    }

    //Update $scope.payment.type and update view render values
    $scope.updatePaymentType = function (tabName) {

        var _tabName = tabName || $scope.paymentTab;

        switch (_tabName) {
            case 'po':
                $scope.payment.type = Constants.order.paymentTypes.po;
                $scope.formModules.contact.show = true;
                $scope.formModules.billingAddress.show = false;
                $scope.formModules.creditCard.show = false;
                $scope.formModules.ccEmails.show = true;
                $scope.formModules.ua.show = false;
                $scope.formModules.po.show = true;
                break;
            case 'ua':
                $scope.payment.type = Constants.order.paymentTypes.ua;
                $scope.formModules.contact.show = true;
                $scope.formModules.billingAddress.show = false;
                $scope.formModules.creditCard.show = false;
                $scope.formModules.ccEmails.show = true;
                $scope.formModules.ua.show = true;
                $scope.formModules.po.show = false;
                break;
            case 'cc':
                $scope.payment.type = ($scope.useStoredCard) ? Constants.order.paymentTypes.ccStored : Constants.order.paymentTypes.ccManual;
                $scope.formModules.contact.show = true;
                $scope.formModules.billingAddress.show = true;
                $scope.formModules.creditCard.show = true;
                $scope.formModules.ccEmails.show = true;
                $scope.formModules.ua.show = false;
                $scope.formModules.po.show = false;
                break;
        }

    };

    //Get Number of Voucher fields
    $scope.getNumVouchers = function () {
        //Divide number of tickets by number of attendees per voucher
        var numVouchers = Math.ceil(Cart.getTotalTicketQtys() / Constants.attendeesPerVoucher);
        //If more than 10, limit to 10
        if (numVouchers > 10) numVouchers = 10;
        //Return
        return numVouchers;
    };

    $scope.getVoucherFields = function () {
        var fields = [];
        for (var i = 0; i < $scope.getNumVouchers(); i++) {
            fields.push({ id: i, value: '' });
        };
        return fields;
    };

    $scope.getCountries = function () {
        // Get all countries
        Cart.getCountries(function (countries) {
            $scope.countries = countries;
            // Pre-select country from storage
            if ($rootScope.$storage.user && $rootScope.$storage.user.countryId) {
                $scope.user.country = $scope.countries[$scope.countries.indexOf(filterFilter($scope.countries, { id: $rootScope.$storage.user.countryId })[0])];
                if ($rootScope.$storage.user.stateProvince) $scope.getStatesFromCountry($scope.user.country.id);
            }
            else if ($rootScope.$storage.user.isAnonymousUser || $rootScope.$persistentStorage.devMode) {
                $scope.user.country = $scope.countries[0];
            }

            if ($scope.user.country) $scope.getStatesFromCountry($scope.user.country.id);
        });
    };

    // Get states from selected country
    $scope.getStatesFromCountry = function (countryId) {
        if (!$scope.user || !angular.isDefined(countryId)) return;
        $scope.user.state = '';
        $scope.states = [];
        Cart.getStates(countryId, function (states) {
            $scope.states = states;
            //Select initial state
            if ($rootScope.$storage.user.stateProvince && $rootScope.$storage.user.stateProvince.stateCode !== '') {
                $scope.user.state = $scope.states[$scope.states.indexOf(filterFilter($scope.states, { stateCode: $rootScope.$storage.user.stateProvince.stateCode })[0])];
            }
            else if ($rootScope.$persistentStorage.devMode) $scope.user.state = $scope.states[39];
            else {
                $scope.state = { stateCode: null, name: '' };
            }
        });
    };

    $scope.$on('$destroy', function () {
        $scope.loginListenerRef();
    });

    if ($rootScope.$storage.explorerMode) {
        if (typeof $window.webkit !== "undefined") {
            $window.webkit.messageHandlers.observer.postMessage({ "title": "PAYMENT INFO" });
        }

        if (typeof $window.AndroidCallbacks !== "undefined") {
            $window.AndroidCallbacks.onTitleChange("PAYMENT INFO");
        }
    }

    init();

}]);