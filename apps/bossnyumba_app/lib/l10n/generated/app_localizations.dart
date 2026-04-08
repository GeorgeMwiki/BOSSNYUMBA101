// GENERATED CODE - DO NOT MODIFY BY HAND
//
// This file is generated from lib/l10n/*.arb. To regenerate, run:
//   flutter gen-l10n
//
// The initial version of this file was hand-authored to bootstrap i18n;
// subsequent runs of `flutter gen-l10n` will overwrite it in place.
// ignore_for_file: type=lint

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('sw')
  ];

  String get appTitle;
  String get appTagline;
  String get loginTitle;
  String get loginButton;
  String get logoutButton;
  String get registerTitle;
  String get registerButton;
  String get emailLabel;
  String get emailHint;
  String get passwordLabel;
  String get passwordHint;
  String get confirmPasswordLabel;
  String get forgotPassword;
  String get rememberMe;
  String get dontHaveAccount;
  String get alreadyHaveAccount;
  String get firstNameLabel;
  String get lastNameLabel;
  String get phoneLabel;
  String get validationRequired;
  String get validationInvalidEmail;
  String get validationPasswordTooShort;
  String get validationPasswordMismatch;
  String get navHome;
  String get navPay;
  String get navRequests;
  String get navProfile;
  String get navDashboard;
  String get navWorkOrders;
  String get navInspections;
  String get navPortfolio;
  String get navAdmin;
  String get menuPayments;
  String get menuMaintenance;
  String get menuDocuments;
  String get menuSettings;
  String get menuNotifications;
  String get menuMessages;
  String get menuHelp;
  String get menuAbout;
  String get menuLanguage;
  String get actionSubmit;
  String get actionCancel;
  String get actionSave;
  String get actionDelete;
  String get actionConfirm;
  String get actionEdit;
  String get actionClose;
  String get actionRetry;
  String get actionBack;
  String get actionNext;
  String get actionContinue;
  String get actionDone;
  String get actionSearch;
  String get actionFilter;
  String get actionRefresh;
  String get actionViewAll;
  String get actionSeeMore;
  String get actionAdd;
  String get actionUpload;
  String get actionDownload;
  String get stateLoading;
  String get stateEmpty;
  String get stateError;
  String get stateFailedToLoad;
  String get stateUnknownError;
  String get stateNoInternet;
  String get stateSaving;
  String get stateSaved;
  String welcomeUser(String name);
  String get welcomeResident;
  String get welcomeManager;
  String get welcomeOwner;
  String get welcomeAdmin;
  String get communityFeed;
  String get feedTitle;
  String get payRentTitle;
  String payRentSubtitle(String amount);
  String get messagesCardTitle;
  String get messagesCardSubtitle;
  String get paymentsTitle;
  String get paymentsEmpty;
  String get paymentsInvoiceFallback;
  String get paymentsStatusPending;
  String get paymentsStatusPaid;
  String get paymentsStatusOverdue;
  String get paymentsStatusCancelled;
  String get paymentsAmountDueLabel;
  String get paymentsDueDateLabel;
  String get paymentsPayNow;
  String get paymentsMethodMpesa;
  String get paymentsMethodBankTransfer;
  String get paymentsMethodCard;
  String get paymentsReceiptTitle;
  String get maintenanceTitle;
  String get maintenanceEmpty;
  String get maintenanceNewRequest;
  String get maintenanceNewRequestPlaceholder;
  String get maintenanceRequestFallback;
  String get maintenancePriorityLow;
  String get maintenancePriorityMedium;
  String get maintenancePriorityHigh;
  String get maintenancePriorityUrgent;
  String get maintenanceStatusPending;
  String get maintenanceStatusInProgress;
  String get maintenanceStatusCompleted;
  String get maintenanceStatusCancelled;
  String get maintenanceCategoryPlumbing;
  String get maintenanceCategoryElectrical;
  String get maintenanceCategoryAppliance;
  String get maintenanceCategoryStructural;
  String get maintenanceCategoryOther;
  String get maintenanceDescriptionLabel;
  String get maintenanceAttachPhotos;
  String get workOrdersTitle;
  String get workOrdersEmpty;
  String get workOrderFallback;
  String get inspectionsTitle;
  String get inspectionsEmpty;
  String get inspectionFallback;
  String get inspectionTypeMoveIn;
  String get inspectionTypeMoveOut;
  String get inspectionTypeRoutine;
  String get leaseTitle;
  String get leaseEmpty;
  String get leaseUnitFallback;
  String get leaseStatusActive;
  String get leaseStatusPending;
  String get leaseStatusExpired;
  String get leaseStatusTerminated;
  String get leaseStartDate;
  String get leaseEndDate;
  String get leaseMonthlyRent;
  String get leaseDeposit;
  String get leaseDownloadAgreement;
  String get profileTitle;
  String get profileEditButton;
  String get profilePersonalInfo;
  String get profilePreferences;
  String get profileSecurity;
  String get profileChangePassword;
  String get ownerPortfolioTitle;
  String get ownerNoProperties;
  String get ownerUnableToLoad;
  String get ownerPropertyFallback;
  String get ownerUnitsCountOne;
  String ownerUnitsCountOther(int count);
  String get ownerPropertiesCountOne;
  String ownerPropertiesCountOther(int count);
  String get managerQuickActionWorkOrders;
  String get managerQuickActionInspections;
  String get managerQuickActionOccupancy;
  String get managerQuickActionCollections;
  String get adminTitle;
  String get adminTenants;
  String get adminUsersRoles;
  String get adminSupport;
  String get adminPlatformSettings;
  String get documentsTitle;
  String get documentsEmpty;
  String get documentsUpload;
  String get documentsCategoryIdentity;
  String get documentsCategoryAddress;
  String get documentsCategoryFinancial;
  String get documentsCategoryEmployment;
  String get documentsCategoryIncome;
  String get documentsCategoryLease;
  String get documentsCategoryInspection;
  String get documentsCategoryPayment;
  String get documentsCategoryGuarantor;
  String get documentsCategoryBackground;
  String get documentsCategoryImmigration;
  String get documentsTypeNationalId;
  String get documentsTypePassport;
  String get documentsTypeDriversLicense;
  String get documentsTypeUtilityBill;
  String get documentsTypeBankStatement;
  String get documentsTypeEmploymentLetter;
  String get documentsTypePayslip;
  String get documentsTypeLeaseAgreement;
  String get documentsTypeReceipt;
  String get documentsTypeInvoice;
  String get documentsValidationCustomerIdRequired;
  String get documentsValidationDocumentIdRequired;
  String get documentsValidationAtLeastOneRequired;
  String get documentsValidationTitleRequired;
  String get documentsValidationReasonRequired;
  String get documentsValidationNotesRequired;
  String get documentsEvidencePackTitle;
  String get documentsSubmittedTo;
  String get documentsLegalDepartment;
  String get notificationRentDueSubject;
  String notificationRentDueBody(String amount, String dueDate);
  String notificationRentDueSms(String amount, String dueDate);
  String get notificationRentOverdueSubject;
  String notificationRentOverdueBody(String amount, String days);
  String notificationRentOverdueSms(String amount, String days);
  String get notificationPaymentReceivedSubject;
  String notificationPaymentReceivedBody(String amount);
  String notificationPaymentReceivedSms(String amount);
  String get notificationMaintenanceUpdateSubject;
  String notificationMaintenanceUpdateBody(String workOrderNumber, String status);
  String notificationMaintenanceUpdateSms(String workOrderNumber, String status);
  String get notificationLeaseExpiringSubject;
  String notificationLeaseExpiringBody(String expiryDate);
  String notificationLeaseExpiringSms(String expiryDate);
  String get notificationWelcomeSubject;
  String notificationWelcomeBody(String name);
  String get notificationWelcomeSms;
  String get notificationNewMessageSubject;
  String notificationNewMessageBody(String sender);
  String get notificationInspectionScheduledSubject;
  String notificationInspectionScheduledBody(String date, String time);
  String get notificationDocumentApprovedSubject;
  String notificationDocumentApprovedBody(String title);
  String get notificationDocumentRejectedSubject;
  String notificationDocumentRejectedBody(String title, String reason);
  String get notificationsEmpty;
  String get notificationsMarkAllRead;
  String get errorGeneric;
  String get errorNetwork;
  String get errorSessionExpired;
  String get errorUnauthorized;
  String get errorNotFound;
  String get errorServer;
  String get confirmDeleteTitle;
  String get confirmDeleteMessage;
  String get confirmLogoutTitle;
  String get confirmLogoutMessage;
  String get languageEnglish;
  String get languageSwahili;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['en', 'sw'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en': return AppLocalizationsEn();
    case 'sw': return AppLocalizationsSw();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'BOSSNYUMBA';

  @override
  String get appTagline => 'Property management made simple';

  @override
  String get loginTitle => 'Sign in';

  @override
  String get loginButton => 'Login';

  @override
  String get logoutButton => 'Sign out';

  @override
  String get registerTitle => 'Create account';

  @override
  String get registerButton => 'Register';

  @override
  String get emailLabel => 'Email';

  @override
  String get emailHint => 'you@example.com';

  @override
  String get passwordLabel => 'Password';

  @override
  String get passwordHint => 'Enter your password';

  @override
  String get confirmPasswordLabel => 'Confirm password';

  @override
  String get forgotPassword => 'Forgot password?';

  @override
  String get rememberMe => 'Remember me';

  @override
  String get dontHaveAccount => 'Don\'t have an account?';

  @override
  String get alreadyHaveAccount => 'Already have an account?';

  @override
  String get firstNameLabel => 'First name';

  @override
  String get lastNameLabel => 'Last name';

  @override
  String get phoneLabel => 'Phone';

  @override
  String get validationRequired => 'This field is required';

  @override
  String get validationInvalidEmail => 'Please enter a valid email address';

  @override
  String get validationPasswordTooShort => 'Password must be at least 8 characters';

  @override
  String get validationPasswordMismatch => 'Passwords do not match';

  @override
  String get navHome => 'Home';

  @override
  String get navPay => 'Pay';

  @override
  String get navRequests => 'Requests';

  @override
  String get navProfile => 'Profile';

  @override
  String get navDashboard => 'Dashboard';

  @override
  String get navWorkOrders => 'Work Orders';

  @override
  String get navInspections => 'Inspections';

  @override
  String get navPortfolio => 'Portfolio';

  @override
  String get navAdmin => 'Admin';

  @override
  String get menuPayments => 'Payments';

  @override
  String get menuMaintenance => 'Maintenance';

  @override
  String get menuDocuments => 'Documents';

  @override
  String get menuSettings => 'Settings';

  @override
  String get menuNotifications => 'Notifications';

  @override
  String get menuMessages => 'Messages';

  @override
  String get menuHelp => 'Help';

  @override
  String get menuAbout => 'About';

  @override
  String get menuLanguage => 'Language';

  @override
  String get actionSubmit => 'Submit';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionSave => 'Save';

  @override
  String get actionDelete => 'Delete';

  @override
  String get actionConfirm => 'Confirm';

  @override
  String get actionEdit => 'Edit';

  @override
  String get actionClose => 'Close';

  @override
  String get actionRetry => 'Retry';

  @override
  String get actionBack => 'Back';

  @override
  String get actionNext => 'Next';

  @override
  String get actionContinue => 'Continue';

  @override
  String get actionDone => 'Done';

  @override
  String get actionSearch => 'Search';

  @override
  String get actionFilter => 'Filter';

  @override
  String get actionRefresh => 'Refresh';

  @override
  String get actionViewAll => 'View all';

  @override
  String get actionSeeMore => 'See more';

  @override
  String get actionAdd => 'Add';

  @override
  String get actionUpload => 'Upload';

  @override
  String get actionDownload => 'Download';

  @override
  String get stateLoading => 'Loading...';

  @override
  String get stateEmpty => 'Nothing to show yet';

  @override
  String get stateError => 'Something went wrong';

  @override
  String get stateFailedToLoad => 'Failed to load';

  @override
  String get stateUnknownError => 'Unknown error';

  @override
  String get stateNoInternet => 'No internet connection';

  @override
  String get stateSaving => 'Saving...';

  @override
  String get stateSaved => 'Saved';

  @override
  String welcomeUser(String name) {
    return 'Welcome, ${name}';
  }

  @override
  String get welcomeResident => 'Welcome, Resident';

  @override
  String get welcomeManager => 'Welcome, Manager';

  @override
  String get welcomeOwner => 'Welcome, Owner';

  @override
  String get welcomeAdmin => 'Welcome, Admin';

  @override
  String get communityFeed => 'Your community feed';

  @override
  String get feedTitle => 'Feed';

  @override
  String get payRentTitle => 'Pay rent';

  @override
  String payRentSubtitle(String amount) {
    return '${amount} due';
  }

  @override
  String get messagesCardTitle => 'Messages';

  @override
  String get messagesCardSubtitle => 'Chat with estate manager & groups';

  @override
  String get paymentsTitle => 'Payments';

  @override
  String get paymentsEmpty => 'No invoices yet';

  @override
  String get paymentsInvoiceFallback => 'Invoice';

  @override
  String get paymentsStatusPending => 'Pending';

  @override
  String get paymentsStatusPaid => 'Paid';

  @override
  String get paymentsStatusOverdue => 'Overdue';

  @override
  String get paymentsStatusCancelled => 'Cancelled';

  @override
  String get paymentsAmountDueLabel => 'Amount due';

  @override
  String get paymentsDueDateLabel => 'Due date';

  @override
  String get paymentsPayNow => 'Pay now';

  @override
  String get paymentsMethodMpesa => 'M-Pesa';

  @override
  String get paymentsMethodBankTransfer => 'Bank transfer';

  @override
  String get paymentsMethodCard => 'Card';

  @override
  String get paymentsReceiptTitle => 'Payment receipt';

  @override
  String get maintenanceTitle => 'Maintenance Requests';

  @override
  String get maintenanceEmpty => 'No requests yet';

  @override
  String get maintenanceNewRequest => 'New request';

  @override
  String get maintenanceNewRequestPlaceholder => 'New maintenance request form (placeholder)';

  @override
  String get maintenanceRequestFallback => 'Request';

  @override
  String get maintenancePriorityLow => 'Low';

  @override
  String get maintenancePriorityMedium => 'Medium';

  @override
  String get maintenancePriorityHigh => 'High';

  @override
  String get maintenancePriorityUrgent => 'Urgent';

  @override
  String get maintenanceStatusPending => 'Pending';

  @override
  String get maintenanceStatusInProgress => 'In progress';

  @override
  String get maintenanceStatusCompleted => 'Completed';

  @override
  String get maintenanceStatusCancelled => 'Cancelled';

  @override
  String get maintenanceCategoryPlumbing => 'Plumbing';

  @override
  String get maintenanceCategoryElectrical => 'Electrical';

  @override
  String get maintenanceCategoryAppliance => 'Appliance';

  @override
  String get maintenanceCategoryStructural => 'Structural';

  @override
  String get maintenanceCategoryOther => 'Other';

  @override
  String get maintenanceDescriptionLabel => 'Describe the issue';

  @override
  String get maintenanceAttachPhotos => 'Attach photos';

  @override
  String get workOrdersTitle => 'Work Orders';

  @override
  String get workOrdersEmpty => 'No work orders';

  @override
  String get workOrderFallback => 'Work Order';

  @override
  String get inspectionsTitle => 'Inspections';

  @override
  String get inspectionsEmpty => 'No inspections';

  @override
  String get inspectionFallback => 'Inspection';

  @override
  String get inspectionTypeMoveIn => 'Move-in inspection';

  @override
  String get inspectionTypeMoveOut => 'Move-out inspection';

  @override
  String get inspectionTypeRoutine => 'Routine inspection';

  @override
  String get leaseTitle => 'Lease';

  @override
  String get leaseEmpty => 'No active lease';

  @override
  String get leaseUnitFallback => 'Unit';

  @override
  String get leaseStatusActive => 'Active';

  @override
  String get leaseStatusPending => 'Pending';

  @override
  String get leaseStatusExpired => 'Expired';

  @override
  String get leaseStatusTerminated => 'Terminated';

  @override
  String get leaseStartDate => 'Start date';

  @override
  String get leaseEndDate => 'End date';

  @override
  String get leaseMonthlyRent => 'Monthly rent';

  @override
  String get leaseDeposit => 'Deposit';

  @override
  String get leaseDownloadAgreement => 'Download agreement';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileEditButton => 'Edit profile';

  @override
  String get profilePersonalInfo => 'Personal information';

  @override
  String get profilePreferences => 'Preferences';

  @override
  String get profileSecurity => 'Security';

  @override
  String get profileChangePassword => 'Change password';

  @override
  String get ownerPortfolioTitle => 'Portfolio';

  @override
  String get ownerNoProperties => 'No properties yet';

  @override
  String get ownerUnableToLoad => 'Unable to load portfolio';

  @override
  String get ownerPropertyFallback => 'Property';

  @override
  String get ownerUnitsCountOne => '1 unit';

  @override
  String ownerUnitsCountOther(int count) {
    return '${count} units';
  }

  @override
  String get ownerPropertiesCountOne => '1 property';

  @override
  String ownerPropertiesCountOther(int count) {
    return '${count} properties';
  }

  @override
  String get managerQuickActionWorkOrders => 'Work Orders';

  @override
  String get managerQuickActionInspections => 'Inspections';

  @override
  String get managerQuickActionOccupancy => 'Occupancy';

  @override
  String get managerQuickActionCollections => 'Collections';

  @override
  String get adminTitle => 'Admin';

  @override
  String get adminTenants => 'Tenants';

  @override
  String get adminUsersRoles => 'Users & Roles';

  @override
  String get adminSupport => 'Support';

  @override
  String get adminPlatformSettings => 'Platform Settings';

  @override
  String get documentsTitle => 'Documents';

  @override
  String get documentsEmpty => 'No documents yet';

  @override
  String get documentsUpload => 'Upload document';

  @override
  String get documentsCategoryIdentity => 'Identity Documents';

  @override
  String get documentsCategoryAddress => 'Proof of Address';

  @override
  String get documentsCategoryFinancial => 'Financial Documents';

  @override
  String get documentsCategoryEmployment => 'Employment Verification';

  @override
  String get documentsCategoryIncome => 'Income Verification';

  @override
  String get documentsCategoryLease => 'Lease Documents';

  @override
  String get documentsCategoryInspection => 'Inspection Reports';

  @override
  String get documentsCategoryPayment => 'Payment Records';

  @override
  String get documentsCategoryGuarantor => 'Guarantor Documents';

  @override
  String get documentsCategoryBackground => 'Background Checks';

  @override
  String get documentsCategoryImmigration => 'Immigration Documents';

  @override
  String get documentsTypeNationalId => 'National ID';

  @override
  String get documentsTypePassport => 'Passport';

  @override
  String get documentsTypeDriversLicense => 'Driver\'s license';

  @override
  String get documentsTypeUtilityBill => 'Utility bill';

  @override
  String get documentsTypeBankStatement => 'Bank statement';

  @override
  String get documentsTypeEmploymentLetter => 'Employment letter';

  @override
  String get documentsTypePayslip => 'Payslip';

  @override
  String get documentsTypeLeaseAgreement => 'Lease agreement';

  @override
  String get documentsTypeReceipt => 'Receipt';

  @override
  String get documentsTypeInvoice => 'Invoice';

  @override
  String get documentsValidationCustomerIdRequired => 'Customer ID is required';

  @override
  String get documentsValidationDocumentIdRequired => 'Document ID is required';

  @override
  String get documentsValidationAtLeastOneRequired => 'At least one document required';

  @override
  String get documentsValidationTitleRequired => 'Title is required';

  @override
  String get documentsValidationReasonRequired => 'Reason is required';

  @override
  String get documentsValidationNotesRequired => 'Notes required';

  @override
  String get documentsEvidencePackTitle => 'Evidence Pack';

  @override
  String get documentsSubmittedTo => 'Submitted to';

  @override
  String get documentsLegalDepartment => 'Legal Department';

  @override
  String get notificationRentDueSubject => 'Rent Due Reminder';

  @override
  String notificationRentDueBody(String amount, String dueDate) {
    return 'Your rent payment of ${amount} is due on ${dueDate}.';
  }

  @override
  String notificationRentDueSms(String amount, String dueDate) {
    return 'Rent due: ${amount} on ${dueDate}. Pay on time to avoid late fees.';
  }

  @override
  String get notificationRentOverdueSubject => 'Rent Overdue Notice';

  @override
  String notificationRentOverdueBody(String amount, String days) {
    return 'Your rent payment of ${amount} is ${days} days overdue. Please pay immediately to avoid late fees.';
  }

  @override
  String notificationRentOverdueSms(String amount, String days) {
    return 'URGENT: Rent ${amount} is ${days} days overdue. Please pay now.';
  }

  @override
  String get notificationPaymentReceivedSubject => 'Payment Received';

  @override
  String notificationPaymentReceivedBody(String amount) {
    return 'We received your payment of ${amount}. Thank you for your payment.';
  }

  @override
  String notificationPaymentReceivedSms(String amount) {
    return 'Payment of ${amount} received. Thank you!';
  }

  @override
  String get notificationMaintenanceUpdateSubject => 'Maintenance Update';

  @override
  String notificationMaintenanceUpdateBody(String workOrderNumber, String status) {
    return 'Your maintenance request #${workOrderNumber} has been updated: ${status}.';
  }

  @override
  String notificationMaintenanceUpdateSms(String workOrderNumber, String status) {
    return 'Maintenance #${workOrderNumber}: ${status}';
  }

  @override
  String get notificationLeaseExpiringSubject => 'Lease Expiring Soon';

  @override
  String notificationLeaseExpiringBody(String expiryDate) {
    return 'Your lease will expire on ${expiryDate}. Please contact us about renewal options.';
  }

  @override
  String notificationLeaseExpiringSms(String expiryDate) {
    return 'Lease expires ${expiryDate}. Contact us for renewal.';
  }

  @override
  String get notificationWelcomeSubject => 'Welcome to BOSSNYUMBA';

  @override
  String notificationWelcomeBody(String name) {
    return 'Hi ${name}, welcome to BOSSNYUMBA! We\'re excited to have you. Your property management dashboard is ready.';
  }

  @override
  String get notificationWelcomeSms => 'Welcome to BOSSNYUMBA! Your dashboard is ready.';

  @override
  String get notificationNewMessageSubject => 'New message';

  @override
  String notificationNewMessageBody(String sender) {
    return '${sender} sent you a new message.';
  }

  @override
  String get notificationInspectionScheduledSubject => 'Inspection Scheduled';

  @override
  String notificationInspectionScheduledBody(String date, String time) {
    return 'An inspection has been scheduled for ${date} at ${time}.';
  }

  @override
  String get notificationDocumentApprovedSubject => 'Document approved';

  @override
  String notificationDocumentApprovedBody(String title) {
    return 'Your document "${title}" has been approved.';
  }

  @override
  String get notificationDocumentRejectedSubject => 'Document rejected';

  @override
  String notificationDocumentRejectedBody(String title, String reason) {
    return 'Your document "${title}" was rejected. Reason: ${reason}.';
  }

  @override
  String get notificationsEmpty => 'You\'re all caught up';

  @override
  String get notificationsMarkAllRead => 'Mark all as read';

  @override
  String get errorGeneric => 'An unexpected error occurred. Please try again.';

  @override
  String get errorNetwork => 'Please check your internet connection and try again.';

  @override
  String get errorSessionExpired => 'Your session has expired. Please sign in again.';

  @override
  String get errorUnauthorized => 'You don\'t have permission to perform this action.';

  @override
  String get errorNotFound => 'The requested item could not be found.';

  @override
  String get errorServer => 'The server is having trouble. Please try again shortly.';

  @override
  String get confirmDeleteTitle => 'Delete this item?';

  @override
  String get confirmDeleteMessage => 'This action cannot be undone.';

  @override
  String get confirmLogoutTitle => 'Sign out?';

  @override
  String get confirmLogoutMessage => 'You\'ll need to sign in again next time.';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageSwahili => 'Swahili';
}

/// The translations for Swahili (`sw`).
class AppLocalizationsSw extends AppLocalizations {
  AppLocalizationsSw([String locale = 'sw']) : super(locale);

  @override
  String get appTitle => 'BOSSNYUMBA';

  @override
  String get appTagline => 'Usimamizi wa mali kwa urahisi';

  @override
  String get loginTitle => 'Ingia';

  @override
  String get loginButton => 'Ingia';

  @override
  String get logoutButton => 'Toka';

  @override
  String get registerTitle => 'Fungua akaunti';

  @override
  String get registerButton => 'Jisajili';

  @override
  String get emailLabel => 'Barua pepe';

  @override
  String get emailHint => 'wewe@mfano.com';

  @override
  String get passwordLabel => 'Nenosiri';

  @override
  String get passwordHint => 'Weka nenosiri lako';

  @override
  String get confirmPasswordLabel => 'Thibitisha nenosiri';

  @override
  String get forgotPassword => 'Umesahau nenosiri?';

  @override
  String get rememberMe => 'Nikumbuke';

  @override
  String get dontHaveAccount => 'Huna akaunti?';

  @override
  String get alreadyHaveAccount => 'Una akaunti tayari?';

  @override
  String get firstNameLabel => 'Jina la kwanza';

  @override
  String get lastNameLabel => 'Jina la ukoo';

  @override
  String get phoneLabel => 'Simu';

  @override
  String get validationRequired => 'Sehemu hii inahitajika';

  @override
  String get validationInvalidEmail => 'Tafadhali weka anwani sahihi ya barua pepe';

  @override
  String get validationPasswordTooShort => 'Nenosiri lazima liwe na angalau herufi 8';

  @override
  String get validationPasswordMismatch => 'Manenosiri hayafanani';

  @override
  String get navHome => 'Mwanzo';

  @override
  String get navPay => 'Lipa';

  @override
  String get navRequests => 'Maombi';

  @override
  String get navProfile => 'Wasifu';

  @override
  String get navDashboard => 'Dashibodi';

  @override
  String get navWorkOrders => 'Kazi';

  @override
  String get navInspections => 'Ukaguzi';

  @override
  String get navPortfolio => 'Mali';

  @override
  String get navAdmin => 'Msimamizi';

  @override
  String get menuPayments => 'Malipo';

  @override
  String get menuMaintenance => 'Matengenezo';

  @override
  String get menuDocuments => 'Nyaraka';

  @override
  String get menuSettings => 'Mipangilio';

  @override
  String get menuNotifications => 'Arifa';

  @override
  String get menuMessages => 'Ujumbe';

  @override
  String get menuHelp => 'Msaada';

  @override
  String get menuAbout => 'Kuhusu';

  @override
  String get menuLanguage => 'Lugha';

  @override
  String get actionSubmit => 'Wasilisha';

  @override
  String get actionCancel => 'Ghairi';

  @override
  String get actionSave => 'Hifadhi';

  @override
  String get actionDelete => 'Futa';

  @override
  String get actionConfirm => 'Thibitisha';

  @override
  String get actionEdit => 'Hariri';

  @override
  String get actionClose => 'Funga';

  @override
  String get actionRetry => 'Jaribu tena';

  @override
  String get actionBack => 'Rudi';

  @override
  String get actionNext => 'Endelea';

  @override
  String get actionContinue => 'Endelea';

  @override
  String get actionDone => 'Imekamilika';

  @override
  String get actionSearch => 'Tafuta';

  @override
  String get actionFilter => 'Chuja';

  @override
  String get actionRefresh => 'Onyesha upya';

  @override
  String get actionViewAll => 'Angalia yote';

  @override
  String get actionSeeMore => 'Ona zaidi';

  @override
  String get actionAdd => 'Ongeza';

  @override
  String get actionUpload => 'Pakia';

  @override
  String get actionDownload => 'Pakua';

  @override
  String get stateLoading => 'Inapakia...';

  @override
  String get stateEmpty => 'Hakuna cha kuonyesha bado';

  @override
  String get stateError => 'Hitilafu imetokea';

  @override
  String get stateFailedToLoad => 'Imeshindwa kupakia';

  @override
  String get stateUnknownError => 'Hitilafu isiyojulikana';

  @override
  String get stateNoInternet => 'Hakuna muunganisho wa intaneti';

  @override
  String get stateSaving => 'Inahifadhi...';

  @override
  String get stateSaved => 'Imehifadhiwa';

  @override
  String welcomeUser(String name) {
    return 'Karibu, ${name}';
  }

  @override
  String get welcomeResident => 'Karibu, Mkazi';

  @override
  String get welcomeManager => 'Karibu, Msimamizi';

  @override
  String get welcomeOwner => 'Karibu, Mmiliki';

  @override
  String get welcomeAdmin => 'Karibu, Msimamizi';

  @override
  String get communityFeed => 'Mlisho wa jamii yako';

  @override
  String get feedTitle => 'Mlisho';

  @override
  String get payRentTitle => 'Lipa kodi';

  @override
  String payRentSubtitle(String amount) {
    return '${amount} inadaiwa';
  }

  @override
  String get messagesCardTitle => 'Ujumbe';

  @override
  String get messagesCardSubtitle => 'Ongea na msimamizi wa estate na vikundi';

  @override
  String get paymentsTitle => 'Malipo';

  @override
  String get paymentsEmpty => 'Hakuna ankara bado';

  @override
  String get paymentsInvoiceFallback => 'Ankara';

  @override
  String get paymentsStatusPending => 'Inasubiri';

  @override
  String get paymentsStatusPaid => 'Imelipwa';

  @override
  String get paymentsStatusOverdue => 'Imechelewa';

  @override
  String get paymentsStatusCancelled => 'Imeghairiwa';

  @override
  String get paymentsAmountDueLabel => 'Kiasi kinachodaiwa';

  @override
  String get paymentsDueDateLabel => 'Tarehe ya mwisho';

  @override
  String get paymentsPayNow => 'Lipa sasa';

  @override
  String get paymentsMethodMpesa => 'M-Pesa';

  @override
  String get paymentsMethodBankTransfer => 'Uhamisho wa benki';

  @override
  String get paymentsMethodCard => 'Kadi';

  @override
  String get paymentsReceiptTitle => 'Risiti ya malipo';

  @override
  String get maintenanceTitle => 'Maombi ya Matengenezo';

  @override
  String get maintenanceEmpty => 'Hakuna maombi bado';

  @override
  String get maintenanceNewRequest => 'Ombi jipya';

  @override
  String get maintenanceNewRequestPlaceholder => 'Fomu ya ombi jipya la matengenezo (nafasi ya muda)';

  @override
  String get maintenanceRequestFallback => 'Ombi';

  @override
  String get maintenancePriorityLow => 'Chini';

  @override
  String get maintenancePriorityMedium => 'Wastani';

  @override
  String get maintenancePriorityHigh => 'Juu';

  @override
  String get maintenancePriorityUrgent => 'Haraka';

  @override
  String get maintenanceStatusPending => 'Inasubiri';

  @override
  String get maintenanceStatusInProgress => 'Inaendelea';

  @override
  String get maintenanceStatusCompleted => 'Imekamilika';

  @override
  String get maintenanceStatusCancelled => 'Imeghairiwa';

  @override
  String get maintenanceCategoryPlumbing => 'Mabomba';

  @override
  String get maintenanceCategoryElectrical => 'Umeme';

  @override
  String get maintenanceCategoryAppliance => 'Vifaa vya nyumbani';

  @override
  String get maintenanceCategoryStructural => 'Muundo wa jengo';

  @override
  String get maintenanceCategoryOther => 'Nyingine';

  @override
  String get maintenanceDescriptionLabel => 'Eleza tatizo';

  @override
  String get maintenanceAttachPhotos => 'Ambatisha picha';

  @override
  String get workOrdersTitle => 'Kazi za Matengenezo';

  @override
  String get workOrdersEmpty => 'Hakuna kazi za matengenezo';

  @override
  String get workOrderFallback => 'Kazi';

  @override
  String get inspectionsTitle => 'Ukaguzi';

  @override
  String get inspectionsEmpty => 'Hakuna ukaguzi';

  @override
  String get inspectionFallback => 'Ukaguzi';

  @override
  String get inspectionTypeMoveIn => 'Ukaguzi wa kuingia';

  @override
  String get inspectionTypeMoveOut => 'Ukaguzi wa kuondoka';

  @override
  String get inspectionTypeRoutine => 'Ukaguzi wa kawaida';

  @override
  String get leaseTitle => 'Hati ya Kodi';

  @override
  String get leaseEmpty => 'Hakuna hati ya kodi inayotumika';

  @override
  String get leaseUnitFallback => 'Chumba';

  @override
  String get leaseStatusActive => 'Inatumika';

  @override
  String get leaseStatusPending => 'Inasubiri';

  @override
  String get leaseStatusExpired => 'Imemalizika';

  @override
  String get leaseStatusTerminated => 'Imesitishwa';

  @override
  String get leaseStartDate => 'Tarehe ya kuanza';

  @override
  String get leaseEndDate => 'Tarehe ya mwisho';

  @override
  String get leaseMonthlyRent => 'Kodi ya mwezi';

  @override
  String get leaseDeposit => 'Amana';

  @override
  String get leaseDownloadAgreement => 'Pakua mkataba';

  @override
  String get profileTitle => 'Wasifu';

  @override
  String get profileEditButton => 'Hariri wasifu';

  @override
  String get profilePersonalInfo => 'Taarifa binafsi';

  @override
  String get profilePreferences => 'Mapendeleo';

  @override
  String get profileSecurity => 'Usalama';

  @override
  String get profileChangePassword => 'Badilisha nenosiri';

  @override
  String get ownerPortfolioTitle => 'Mali';

  @override
  String get ownerNoProperties => 'Hakuna mali bado';

  @override
  String get ownerUnableToLoad => 'Imeshindwa kupakia mali';

  @override
  String get ownerPropertyFallback => 'Mali';

  @override
  String get ownerUnitsCountOne => 'Chumba 1';

  @override
  String ownerUnitsCountOther(int count) {
    return 'Vyumba ${count}';
  }

  @override
  String get ownerPropertiesCountOne => 'Mali 1';

  @override
  String ownerPropertiesCountOther(int count) {
    return 'Mali ${count}';
  }

  @override
  String get managerQuickActionWorkOrders => 'Kazi za Matengenezo';

  @override
  String get managerQuickActionInspections => 'Ukaguzi';

  @override
  String get managerQuickActionOccupancy => 'Wakazi';

  @override
  String get managerQuickActionCollections => 'Mapato';

  @override
  String get adminTitle => 'Msimamizi';

  @override
  String get adminTenants => 'Wapangaji';

  @override
  String get adminUsersRoles => 'Watumiaji na Majukumu';

  @override
  String get adminSupport => 'Msaada';

  @override
  String get adminPlatformSettings => 'Mipangilio ya Mfumo';

  @override
  String get documentsTitle => 'Nyaraka';

  @override
  String get documentsEmpty => 'Hakuna nyaraka bado';

  @override
  String get documentsUpload => 'Pakia nyaraka';

  @override
  String get documentsCategoryIdentity => 'Nyaraka za Utambulisho';

  @override
  String get documentsCategoryAddress => 'Uthibitisho wa Makazi';

  @override
  String get documentsCategoryFinancial => 'Nyaraka za Kifedha';

  @override
  String get documentsCategoryEmployment => 'Uthibitisho wa Ajira';

  @override
  String get documentsCategoryIncome => 'Uthibitisho wa Mapato';

  @override
  String get documentsCategoryLease => 'Nyaraka za Hati ya Kodi';

  @override
  String get documentsCategoryInspection => 'Ripoti za Ukaguzi';

  @override
  String get documentsCategoryPayment => 'Kumbukumbu za Malipo';

  @override
  String get documentsCategoryGuarantor => 'Nyaraka za Mdhamini';

  @override
  String get documentsCategoryBackground => 'Uchunguzi wa Nyuma';

  @override
  String get documentsCategoryImmigration => 'Nyaraka za Uhamiaji';

  @override
  String get documentsTypeNationalId => 'Kitambulisho cha Taifa';

  @override
  String get documentsTypePassport => 'Pasipoti';

  @override
  String get documentsTypeDriversLicense => 'Leseni ya udereva';

  @override
  String get documentsTypeUtilityBill => 'Bili ya huduma';

  @override
  String get documentsTypeBankStatement => 'Taarifa ya benki';

  @override
  String get documentsTypeEmploymentLetter => 'Barua ya ajira';

  @override
  String get documentsTypePayslip => 'Karatasi ya mshahara';

  @override
  String get documentsTypeLeaseAgreement => 'Mkataba wa kodi';

  @override
  String get documentsTypeReceipt => 'Risiti';

  @override
  String get documentsTypeInvoice => 'Ankara';

  @override
  String get documentsValidationCustomerIdRequired => 'Kitambulisho cha mteja kinahitajika';

  @override
  String get documentsValidationDocumentIdRequired => 'Kitambulisho cha nyaraka kinahitajika';

  @override
  String get documentsValidationAtLeastOneRequired => 'Angalau nyaraka moja inahitajika';

  @override
  String get documentsValidationTitleRequired => 'Kichwa kinahitajika';

  @override
  String get documentsValidationReasonRequired => 'Sababu inahitajika';

  @override
  String get documentsValidationNotesRequired => 'Maelezo yanahitajika';

  @override
  String get documentsEvidencePackTitle => 'Kifurushi cha Ushahidi';

  @override
  String get documentsSubmittedTo => 'Imewasilishwa kwa';

  @override
  String get documentsLegalDepartment => 'Idara ya Sheria';

  @override
  String get notificationRentDueSubject => 'Ukumbusho wa Kodi';

  @override
  String notificationRentDueBody(String amount, String dueDate) {
    return 'Malipo yako ya kodi ya ${amount} yanakabiliwa tarehe ${dueDate}.';
  }

  @override
  String notificationRentDueSms(String amount, String dueDate) {
    return 'Kodi: ${amount} tarehe ${dueDate}. Maliza malipo kwa wakati.';
  }

  @override
  String get notificationRentOverdueSubject => 'Onyo la Kodi Iliyochelewa';

  @override
  String notificationRentOverdueBody(String amount, String days) {
    return 'Malipo yako ya kodi ya ${amount} yamechelewa siku ${days}. Tafadhali maliza haraka.';
  }

  @override
  String notificationRentOverdueSms(String amount, String days) {
    return 'MUHIMU: Kodi ${amount} imechelewa siku ${days}. Maliza haraka.';
  }

  @override
  String get notificationPaymentReceivedSubject => 'Malipo Yamepokelewa';

  @override
  String notificationPaymentReceivedBody(String amount) {
    return 'Tumepokea malipo yako ya ${amount}. Asante kwa malipo yako.';
  }

  @override
  String notificationPaymentReceivedSms(String amount) {
    return 'Malipo ya ${amount} yamepokelewa. Asante!';
  }

  @override
  String get notificationMaintenanceUpdateSubject => 'Sasisho la Matengenezo';

  @override
  String notificationMaintenanceUpdateBody(String workOrderNumber, String status) {
    return 'Ombi lako la matengenezo #${workOrderNumber} limesasishwa: ${status}.';
  }

  @override
  String notificationMaintenanceUpdateSms(String workOrderNumber, String status) {
    return 'Matengenezo #${workOrderNumber}: ${status}';
  }

  @override
  String get notificationLeaseExpiringSubject => 'Hati ya Kodi Inakaribia Kumalizika';

  @override
  String notificationLeaseExpiringBody(String expiryDate) {
    return 'Hati yako ya kodi itamalizika tarehe ${expiryDate}. Wasiliana nasi kuhusu uhuishaji.';
  }

  @override
  String notificationLeaseExpiringSms(String expiryDate) {
    return 'Hati inamalizika ${expiryDate}. Wasiliana nasi kwa uhuishaji.';
  }

  @override
  String get notificationWelcomeSubject => 'Karibu BOSSNYUMBA';

  @override
  String notificationWelcomeBody(String name) {
    return 'Habari ${name}, karibu BOSSNYUMBA! Tuna furaha kuwa nawe. Dashibodi yako iko tayari.';
  }

  @override
  String get notificationWelcomeSms => 'Karibu BOSSNYUMBA! Dashibodi yako iko tayari.';

  @override
  String get notificationNewMessageSubject => 'Ujumbe mpya';

  @override
  String notificationNewMessageBody(String sender) {
    return '${sender} amekutumia ujumbe mpya.';
  }

  @override
  String get notificationInspectionScheduledSubject => 'Ukaguzi Umepangwa';

  @override
  String notificationInspectionScheduledBody(String date, String time) {
    return 'Ukaguzi umepangwa kwa tarehe ${date} saa ${time}.';
  }

  @override
  String get notificationDocumentApprovedSubject => 'Nyaraka imeidhinishwa';

  @override
  String notificationDocumentApprovedBody(String title) {
    return 'Nyaraka yako "${title}" imeidhinishwa.';
  }

  @override
  String get notificationDocumentRejectedSubject => 'Nyaraka imekataliwa';

  @override
  String notificationDocumentRejectedBody(String title, String reason) {
    return 'Nyaraka yako "${title}" imekataliwa. Sababu: ${reason}.';
  }

  @override
  String get notificationsEmpty => 'Umesoma arifa zote';

  @override
  String get notificationsMarkAllRead => 'Weka zote kama zimesomwa';

  @override
  String get errorGeneric => 'Hitilafu isiyotarajiwa imetokea. Tafadhali jaribu tena.';

  @override
  String get errorNetwork => 'Tafadhali angalia muunganisho wa intaneti kisha jaribu tena.';

  @override
  String get errorSessionExpired => 'Muda wa kikao chako umeisha. Tafadhali ingia tena.';

  @override
  String get errorUnauthorized => 'Huna ruhusa ya kufanya kitendo hiki.';

  @override
  String get errorNotFound => 'Kitu ulichotafuta hakikupatikana.';

  @override
  String get errorServer => 'Seva ina matatizo. Tafadhali jaribu tena baadaye.';

  @override
  String get confirmDeleteTitle => 'Futa kipengee hiki?';

  @override
  String get confirmDeleteMessage => 'Kitendo hiki hakiwezi kubadilishwa.';

  @override
  String get confirmLogoutTitle => 'Toka?';

  @override
  String get confirmLogoutMessage => 'Utahitaji kuingia tena wakati ujao.';

  @override
  String get languageEnglish => 'Kiingereza';

  @override
  String get languageSwahili => 'Kiswahili';
}
