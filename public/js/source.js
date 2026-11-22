$(function () {
    $('button').button();
    $('#dashboardTabs').tabs();
    $('#customerDate').datepicker();
    $('#accordion').accordion({
        collapsible: true,
        heightStyle: 'content'
    });
    $('#customerDialog').dialog({
        autoOpen: false,
        modal: true,
        width: 450,
        buttons: {
            Close: function () {
                $(this).dialog('close');
            }
        }
    });
    $('#newCustomerButton').on('click', function () {
        $('#customerDialog').dialog('open');
    });
});
