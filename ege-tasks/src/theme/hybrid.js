/** @type {import('antd').ThemeConfig} */
export const hybridTheme = {
  token: {
    // Акцент — cobalt
    colorPrimary:   '#2B4BFF',
    colorSuccess:   '#0D9488',
    colorWarning:   '#D97706',
    colorError:     '#E11D48',
    colorInfo:      '#2B4BFF',

    // Нейтрали
    colorBgBase:           '#FBFBFD',
    colorBgContainer:      '#FFFFFF',
    colorBgLayout:         '#FBFBFD',
    colorBgElevated:       '#FFFFFF',
    colorText:             '#0D1321',
    colorTextSecondary:    '#2A2F3A',
    colorTextTertiary:     '#646A76',
    colorTextQuaternary:   '#9AA0AC',
    colorBorder:           '#E5E7EB',
    colorBorderSecondary:  '#EEF0F3',
    colorFillAlter:        '#F7F8FA',
    colorFillSecondary:    '#F3F4F6',

    // Типографика — Geist
    fontFamily:     '"Geist", "Inter", system-ui, sans-serif',
    fontFamilyCode: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
    fontSize:           13,
    fontSizeLG:         14,
    fontSizeSM:         12,
    fontSizeHeading1:   26,
    fontSizeHeading2:   20,
    fontSizeHeading3:   16,
    fontSizeHeading4:   14,

    // Форма
    borderRadius:   6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 3,

    // Тени
    boxShadow:          '0 1px 2px rgba(13,19,33,.04), 0 0 0 1px rgba(13,19,33,.05)',
    boxShadowSecondary: '0 1px 2px rgba(13,19,33,.04)',

    // Плотность — academic
    controlHeight:   34,
    controlHeightLG: 40,
    controlHeightSM: 28,

    // Отступы
    paddingContentHorizontal:  14,
    paddingContentVertical:    10,
    paddingContentVerticalSM:   6,
    paddingContentVerticalLG:  16,

    // Motion
    motionDurationFast:   '0.1s',
    motionDurationMid:    '0.15s',
    motionDurationSlow:   '0.2s',
  },

  components: {
    Button: {
      primaryShadow:
        '0 1px 0 rgba(255,255,255,.16) inset, 0 1px 2px rgba(43,75,255,.35), 0 2px 4px rgba(43,75,255,.15)',
      defaultShadow: '0 1px 2px rgba(13,19,33,.04)',
      fontWeight: 500,
      paddingInline: 14,
    },

    Table: {
      headerBg:         '#FFFFFF',
      headerColor:      '#646A76',
      headerSortActiveBg: '#FFFFFF',
      headerSortHoverBg:  '#F7F8FA',
      rowHoverBg:       '#F7F8FA',
      rowSelectedBg:    '#EEF2FF',
      borderColor:      '#EEF0F3',
      cellPaddingBlock:  11,
      cellPaddingInline: 12,
      headerFontSize:   10.5,
      fontSize:         13,
    },

    Menu: {
      itemBg:            'transparent',
      itemSelectedBg:    '#E7ECFF',
      itemSelectedColor: '#1A34D1',
      itemHoverBg:       '#F7F8FA',
      itemHoverColor:    '#0D1321',
      itemBorderRadius:  6,
      itemHeight:        36,
      subMenuItemBg:     'transparent',
      groupTitleColor:   '#9AA0AC',
      groupTitleFontSize: 10.5,
    },

    Layout: {
      siderBg:   '#FBFBFD',
      headerBg:  '#FFFFFF',
      bodyBg:    '#FBFBFD',
      triggerBg: '#F3F4F6',
    },

    Input: {
      activeShadow: '0 0 0 3px #E7ECFF',
      hoverBorderColor: '#D1D5DB',
    },

    Select: {
      optionSelectedBg:    '#E7ECFF',
      optionSelectedColor: '#1A34D1',
      optionActiveBg:      '#F7F8FA',
    },

    Tabs: {
      inkBarColor:     '#2B4BFF',
      itemActiveColor: '#1A34D1',
      itemSelectedColor: '#0D1321',
      itemColor:       '#646A76',
      titleFontSize:   13,
      cardBg:          '#F3F4F6',
    },

    Card: {
      headerBg:  'transparent',
      paddingLG: 20,
      padding:   16,
    },

    Tag: {
      defaultBg:    '#F3F4F6',
      defaultColor: '#2A2F3A',
      borderRadiusSM: 4,
    },

    Badge: {
      colorBgContainer: '#F3F4F6',
    },

    Modal: {
      headerBg: '#FFFFFF',
      contentBg: '#FFFFFF',
      footerBg: '#FFFFFF',
    },

    Breadcrumb: {
      linkColor:      '#646A76',
      linkHoverColor: '#0D1321',
      lastItemColor:  '#0D1321',
      separatorColor: '#9AA0AC',
      fontSize:       13,
    },

    Divider: {
      colorSplit: '#EEF0F3',
    },

    Statistic: {
      titleFontSize:   11,
      contentFontSize: 30,
    },

    Tooltip: {
      colorBgSpotlight: '#0D1321',
      colorTextLightSolid: '#FFFFFF',
      borderRadius: 6,
      fontSize: 12,
    },

    Dropdown: {
      paddingBlock: 6,
    },

    Form: {
      labelFontSize: 13,
      itemMarginBottom: 14,
      verticalLabelPadding: '0 0 4px',
    },
  },
};
