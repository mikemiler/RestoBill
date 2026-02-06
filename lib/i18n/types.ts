export type Language = 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt'

export interface LanguageConfig {
  code: Language
  label: string
  flag: string
}

export const LANGUAGES: LanguageConfig[] = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
]

export const DEFAULT_LANGUAGE: Language = 'en'

export interface Translations {
  common: {
    copy: string
    copied: string
    cancel: string
    save: string
    saving: string
    delete: string
    edit: string
    close: string
    loading: string
    error: string
    yes: string
    no: string
    total: string
    subtotal: string
    tip: string
    back: string
    continue: string
    add: string
    adding: string
    genericError: string
  }

  home: {
    tagline: string
    howItWorks: string
    importantNote: string
    step1: string
    step2: string
    step3: string
    step4: string
    step5: string
    ctaButton: string
    freeInfo: string
  }

  create: {
    title: string
    subtitle: string
    uploadHeading: string
    takePhoto: string
    or: string
    selectFile: string
    fileTypes: string
    otherFile: string
    analyzeButton: string
    analyzing: string
    analysisComplete: string
    photoTip: string
    yourDataHeading: string
    whileAnalyzing: string
    yourName: string
    namePlaceholder: string
    paypalLabel: string
    paypalOptional: string
    paypalHint: string
    paypalValidation: string
    paypalPaymentsGoTo: string
    paypalTest: string
    paypalTestHint: string
    paypalCashOnly: string
    aiAnalyzing: string
    pleaseWait: string
    enterName: string
    submit: string
    backToHome: string
    paypalSetupTitle: string
    paypalSetupText: string
    fileTypeError: string
    fileTooLarge: string
    selectReceipt: string
    imageTooLargeAfterCompress: string
    errorCreating: string
    errorUploading: string
    errorSaving: string
    waitForAnalysis: string
    titleAttr: string
  }

  splitForm: {
    welcomeTitle: string
    welcomeSubtitle: string
    welcomeInputLabel: string
    welcomePlaceholder: string
    welcomeErrorEmpty: string
    welcomeContinue: string
    welcomeInfo: string
    itemsLabel: string
    editFormTitle: string
    nameLabel: string
    quantityLabel: string
    pricePerUnitLabel: string
    totalPriceLabel: string
    addNewButton: string
    addNewItemButton: string
    namePlaceholder: string
    pricePerUnitLabelAlt: string
    tipLabel: string
    customAmount: string
    tipPlaceholder: string
    yourItemsLabel: string
    subtotalLabel: string
    tipAmountLabel: string
    totalLabel: string
    paymentInstruction: string
    paypalHeader: string
    amountCopied: string
    copyAmount: string
    openPaypal: string
    copyFirstHint: string
    cashHeader: string
    cashInstruction: string
    selectionTotal: string
    progressComplete: string
    progressFullyAllocated: string
    progressRemaining: string
    progressOverbooked: string
    errorSave: string
    errorDelete: string
    errorCreate: string
    confirmDelete: string
    guestDefault: string
  }

  billItemCard: {
    actionsMenu: string
    editButton: string
    deleteButton: string
    overbooked: string
    completelyDivided: string
    stillOpen: string
    whoHadThis: string
    youLabel: string
    stillOpenLabel: string
    fractionalAmountToggle: string
    fractionalAmountToggleOpen: string
    forMe: string
    people: string
    noFractions: string
    nothingSelected: string
    fractionPreview: string
  }

  guestSelections: {
    allGuests: string
    paid: string
    paidHelpText: string
    noSelectionsOwner: string
    noSelectionsGuest: string
    paymentMethodCash: string
    paymentMethodPaypal: string
    tipLabel: string
    confirmingButton: string
    confirmPaymentButton: string
    resettingButton: string
    resetPaymentButton: string
    billTotal: string
    averageTip: string
    totalAmount: string
    confirmedAmount: string
    pendingAmount: string
    errorMarkingPaid: string
    errorResetting: string
  }

  feedback: {
    title: string
    bad: string
    medium: string
    top: string
    thanksPositive: string
    helpReview: string
    googleReview: string
    thanksFeedback: string
    whatCanImprove: string
    feedbackPlaceholder: string
    sendFeedback: string
    sending: string
    feedbackSent: string
    sessionLoading: string
    enterFeedback: string
    errorSaving: string
    errorUnknown: string
  }

  completion: {
    title: string
    message: string
    dismiss: string
    closeLabel: string
  }

  editableName: {
    youAre: string
    forMe: string
    namePlaceholder: string
    nameEmpty: string
    editTitle: string
    errorSaving: string
  }

  footer: {
    terms: string
    refund: string
    privacy: string
    imprint: string
  }

  whatsapp: {
    shareButton: string
    messageText: string
    reviewRequest: string
  }

  receipt: {
    label: string
    imageAlt: string
  }

  billsList: {
    savedBills: string
    total: string
    paid: string
    outstanding: string
    deleteConfirm: string
    deleteBillLabel: string
  }

  copyButton: {
    copy: string
    copied: string
  }

  container: {
    loadingSelections: string
    yourSelection: string
  }

  donation: {
    heading: string
    text: string
    customAmountLabel: string
    customAmountPlaceholder: string
    supportButton: string
    loadingButton: string
    paymentMethods: string
    minAmount: string
    maxAmount: string
    errorCreating: string
    errorPaddle: string
  }

  splitPage: {
    title: string
    from: string
  }

  statusPage: {
    title: string
    shareLink: string
    shareLinkDescription: string
    qrCodeDescription: string
    guestsAndPayments: string
    liveStatus: string
  }
}
