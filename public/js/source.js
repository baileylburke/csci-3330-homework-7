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
        width: Math.min(450, window.innerWidth - 32),
        buttons: {
            Close: function () {
                $(this).dialog('close');
            }
        }
    });
    $('#newCustomerButton').on('click', function () {
        $('#customerDialog').dialog('open');
    });
    $('.nav-button').on('click', function () {
        const section = $(this).data('section');
        if (section === 'customers') {
            document.getElementById('customers-panel').scrollIntoView();
        } else if (section === 'reports') {
            $('#dashboardTabs').tabs('option', 'active', 1);
            document.getElementById('reports-panel').scrollIntoView();
        } else {
            $('#dashboardTabs').tabs('option', 'active', 0);
            window.scrollTo(0, 0);
        }
    });
});
